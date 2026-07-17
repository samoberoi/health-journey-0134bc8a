import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, ArrowLeft, ChevronRight, ShieldCheck, User, ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COUNTRIES, type Country } from "@/lib/countries";
import { saveUser } from "@/lib/userStore";
import { supabase } from "@/integrations/supabase/client";
import { fetchProfile, loadProfileToLocal } from "@/lib/profileService";
import { fetchActiveSubscription } from "@/lib/subscriptionService";
import { isCoachUser, isAdminUser } from "@/lib/roleService";
import { isChannelPartner } from "@/lib/channelPartnerService";
import { EXPLICIT_LOGOUT_KEY, getExistingSessionUnlessLoggedOut } from "@/contexts/AuthContext";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import logoImg from "@/assets/logo.png";
import AuthHeroCarousel from "@/components/AuthHeroCarousel";
import { toast } from "sonner";
import { persistSupabaseSessionToNative } from "@/lib/nativePersistence";
import { resolvePostAuthRoute } from "@/lib/accessControl";

const DEFAULT_OTP = "111111";

export default function Auth() {
  const [step, setStep] = useState<"phone" | "otp" | "name">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [name, setName] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionPreparing, setSessionPreparing] = useState(true);
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const [countrySearch, setCountrySearch] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const navigate = useNavigate();
  const filteredCountries = COUNTRIES.filter((c) => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q);
  });

  const email = `${phone}@bbd.app`;
  const password = `bbd_${phone}_secure`;

  const persistNativeSession = async (session?: { access_token?: string; refresh_token?: string } | null) => {
    try {
      await persistSupabaseSessionToNative(session);
    } catch {
      /* native storage may be unavailable in preview */
    }
  };

  useEffect(() => {
    let cancelled = false;

    const prepareSession = async () => {
      try {
        const existingSession = await getExistingSessionUnlessLoggedOut();
        if (existingSession) {
          const route = await resolvePostAuthRoute(existingSession.user.id, { missingProfileRoute: null });
          if (route) {
            navigate(route, { replace: true });
            return;
          }
          if (!cancelled) setSessionPreparing(false);
          return;
        }
      } catch {
        /* fall through to fresh login prep */
      }
      if (!cancelled) setSessionPreparing(false);
    };

    prepareSession();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const sendOtp = async () => {
    if (phone.length < 10) return;
    setLoading(true);
    saveUser({ profile: { phone, country: country.name, country_code: country.dial } as any });
    // Simulate OTP send
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setStep("otp");
  };

  const verifyOtp = async () => {
    if (otp !== DEFAULT_OTP) {
      setOtpError("Invalid OTP. Please enter 111111");
      return;
    }
    setOtpError("");
    setLoading(true);

    try {
      try { localStorage.removeItem(EXPLICIT_LOGOUT_KEY); } catch {}
      // Try sign in first (existing user)
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInData?.user) {
        await persistNativeSession(signInData.session);
        // Check if this is an admin
        const isAdmin = await isAdminUser(signInData.user.id);
        if (isAdmin) {
          setLoading(false);
          navigate("/admin-dashboard");
          return;
        }

        // Auto-link coach and partner records by phone
        await supabase.rpc("link_coach_to_user" as any, { _user_id: signInData.user.id, _phone: phone });
        await supabase.rpc("link_partner_to_user" as any, { _user_id: signInData.user.id, _phone: phone });

        // Check if this is a coach
        const isCoach = await isCoachUser(signInData.user.id);
        if (isCoach) {
          setLoading(false);
          navigate("/coach-dashboard");
          return;
        }

        // Check if this is a channel partner
        const isPartner = await isChannelPartner(signInData.user.id);
        if (isPartner) {
          setLoading(false);
          navigate("/partner-dashboard");
          return;
        }


        // Existing user — fetch profile and check onboarding/payment completion
        const profile = await fetchProfile(signInData.user.id);
        if (profile) {
          saveUser({ profile: { phone, country: country.name, country_code: country.dial } as any });
          loadProfileToLocal(profile);
          const activeSubscription = await fetchActiveSubscription(signInData.user.id);
          if (activeSubscription) {
            setLoading(false);
            navigate("/home");
            return;
          }
          if (profile.onboarding_completed) {
            setLoading(false);
            navigate("/plans");
            return;
          }
          if (profile.name) {
            setLoading(false);
            navigate("/setup/purpose");
            return;
          }
        }
        setLoading(false);
        setStep("name");
        return;
      }

      // User doesn't exist yet, or an earlier sign-up exists without an active session.
      if (signInError) {
        const { data: ensureData, error: ensureError } = await supabase.functions.invoke("ensure-phone-user", {
          body: { phone, country: country.name, country_code: country.dial },
        });
        if (ensureError || !ensureData?.ok) {
          toast.error("We couldn't start your secure session. Please try again.");
          setLoading(false);
          return;
        }

        const { data: newSessionData, error: newSessionError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (newSessionError || !newSessionData?.user) {
          toast.error("We couldn't start your secure session. Please enter the OTP again.");
          setLoading(false);
          setStep("otp");
          return;
        }
        await persistNativeSession(newSessionData.session);

        const signedInNewUser = newSessionData.user;

        if (signedInNewUser) {
          // Auto-link coach or partner record by phone if it exists
          const { data: linkedCoachId } = await supabase.rpc(
            "link_coach_to_user" as any,
            { _user_id: signedInNewUser.id, _phone: phone }
          );
          if (linkedCoachId) {
            setLoading(false);
            navigate("/coach-dashboard");
            return;
          }
          const { data: linkedPartnerId } = await supabase.rpc(
            "link_partner_to_user" as any,
            { _user_id: signedInNewUser.id, _phone: phone }
          );
          if (linkedPartnerId) {
            setLoading(false);
            navigate("/partner-dashboard");
            return;
          }

          await supabase.from("profiles" as any).upsert({
            user_id: signedInNewUser.id,
            phone,
            country: country.name,
            country_code: country.dial,
          } as any, { onConflict: "user_id" });

          // Referral codes are now applied at payment time.


          setLoading(false);
          setStep("name");
          return;
        }

      }

      if (signInError) {
        toast.error(signInError.message);
      }
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
      console.error(err);
    }

    setLoading(false);
  };

  const submitName = async () => {
    if (name.trim().length < 2) return;
    const trimmedEmail = emailInput.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError("Please enter a valid email address");
      return;
    }
    setLoading(true);
    setEmailError("");

    // Check email uniqueness
    const { data: exists, error: checkErr } = await supabase.rpc("email_exists" as any, { _email: trimmedEmail });
    if (checkErr) {
      setLoading(false);
      setEmailError("Couldn't verify email. Please try again.");
      return;
    }
    if (exists) {
      setLoading(false);
      setEmailError("This email is already registered. Please sign in with the phone number linked to it.");
      return;
    }

    saveUser({ profile: { name: name.trim(), email: trimmedEmail, phone, country: country.name, country_code: country.dial } as any });

    // Save name + email to backend
    let { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const { data: sessionData } = await supabase.auth.signInWithPassword({ email, password });
      user = sessionData.user;
      if (user) await persistNativeSession(sessionData.session);
    }
    if (!user) {
      setLoading(false);
      toast.error("We couldn't keep you signed in. Please verify your phone again.");
      setStep("otp");
      return;
    }
    if (user) {
      const { error } = await supabase
        .from("profiles" as any)
        .update({ name: name.trim(), email: trimmedEmail, phone, country: country.name, country_code: country.dial } as any)
        .eq("user_id", user.id);
      if (error) console.error("Failed to save name/email:", error);
    }

    const { data: currentSessionData } = await supabase.auth.getSession();
    await persistNativeSession(currentSessionData.session);

    setLoading(false);
    navigate("/setup/purpose");
  };

  const stepIndex = step === "phone" ? 0 : step === "otp" ? 1 : 2;

  if (sessionPreparing) {
    return (
      <div className="phone-container min-h-dvh flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary/25 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="phone-container min-h-dvh flex flex-col relative overflow-hidden bg-background">
      {/* Ambient brand orbs */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full opacity-30 blur-3xl hidden md:block"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)/0.35), transparent 70%)" }} />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 w-72 h-72 rounded-full opacity-25 blur-3xl hidden md:block"
        style={{ background: "radial-gradient(circle, hsl(var(--destructive)/0.30), transparent 70%)" }} />

      <div className={`relative z-10 flex flex-col flex-1 ${step === "name" ? "px-6 pb-8 pt-[calc(env(safe-area-inset-top)+1rem)]" : ""}`}>
        {/* Top bar only on name step */}
        {step === "name" && (
          <div className="flex items-center justify-between mt-4 mb-8">
            <button onClick={() => { setStep("phone"); setOtp(""); }} className="top-icon-btn" aria-label="Back">
              <ArrowLeft className="w-4 h-4" strokeWidth={2} />
            </button>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  animate={{ width: i === stepIndex ? 22 : 6, opacity: i <= stepIndex ? 1 : 0.25 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="h-1.5 rounded-full bg-primary"
                />
              ))}
            </div>
            <span className="w-10 h-10" />
          </div>
        )}

        <AnimatePresence initial={false} mode="wait">
          {step === "phone" && (
            <motion.div key="phone" className="flex flex-col flex-1"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}>

              {/* Top half hero image — extends to top edge */}
              <div className="relative h-[46vh] min-h-[300px] overflow-hidden shadow-card">
                <AuthHeroCarousel />
                <div className="absolute inset-x-0 bottom-0 p-6 pb-8 bg-gradient-to-t from-black/60 via-black/20 to-transparent">
                  <p className="text-white text-[28px] font-black tracking-[-0.02em] leading-tight drop-shadow-lg">Sign in</p>
                </div>
              </div>

              {/* Bottom half content */}
              <div className="flex flex-col flex-1 px-6 pb-8 pt-8">
                <h1 className="text-foreground text-[32px] leading-[1.05] font-black tracking-[-0.03em]">
                  What's your <br /> phone number?
                </h1>
                <p className="text-muted-foreground text-[14px] mt-3 leading-relaxed">
                  We'll text you a 6-digit code to verify it's you. No spam, ever.
                </p>

                <div className="mt-6">
                  <div className="flex items-stretch gap-2.5">
                    <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center gap-2 px-4 rounded-full bg-white shadow-lift border-2 border-border shrink-0 hover:border-primary/50 transition-colors"
                          aria-label="Select country code"
                        >
                          <span className="text-lg leading-none">{country.flag}</span>
                          <span className="text-foreground font-bold text-[15px] tabular">{country.dial}</span>
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={2.5} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="p-0 w-[280px] rounded-2xl overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
                          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                          <input
                            autoFocus
                            value={countrySearch}
                            onChange={(e) => setCountrySearch(e.target.value)}
                            placeholder="Search country or code"
                            className="w-full bg-transparent text-[14px] outline-none placeholder:text-muted-foreground/60"
                          />
                        </div>
                        <div className="max-h-64 overflow-y-auto py-1">
                          {filteredCountries.length === 0 ? (
                            <p className="text-muted-foreground text-[13px] px-4 py-6 text-center">No matches</p>
                          ) : filteredCountries.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => { setCountry(c); setCountryOpen(false); setCountrySearch(""); }}
                              className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/60 transition-colors ${country.code === c.code ? "bg-muted/40" : ""}`}
                            >
                              <span className="text-lg leading-none">{c.flag}</span>
                              <span className="text-foreground text-[14px] font-semibold flex-1 truncate">{c.name}</span>
                              <span className="text-muted-foreground text-[13px] font-bold tabular">{c.dial}</span>
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <div className={`relative flex-1 rounded-full bg-white shadow-lift border-2 px-5 flex items-center transition-all ${phone.length === 10 ? "border-primary ring-4 ring-primary/20" : "border-border"}`}>
                      <input
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        placeholder="98765 43210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        className="w-full bg-transparent text-foreground font-bold text-[18px] tracking-[0.02em] outline-none placeholder:text-muted-foreground/60 placeholder:font-medium py-4 tabular"
                        autoFocus
                      />
                      {phone.length === 10 && (
                        <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
                          className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                          <span className="text-primary-foreground text-[11px] font-black">✓</span>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>

                <label className="text-muted-foreground text-[12px] mt-5 flex items-start gap-2.5 cursor-pointer select-none leading-relaxed">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded-md border-border accent-primary shrink-0 cursor-pointer"
                  />
                  <span>
                    I agree to the{" "}
                    <a href="https://www.byebyediabetesandobesity.com/terms" target="_blank" rel="noopener noreferrer" className="text-foreground font-bold underline underline-offset-2">Terms</a>{" "}and{" "}
                    <a href="https://www.byebyediabetesandobesity.com/privacy" target="_blank" rel="noopener noreferrer" className="text-foreground font-bold underline underline-offset-2">Privacy Policy</a>.
                  </span>
                </label>

                <div className="mt-auto pt-6">
                  <motion.button
                    onClick={sendOtp}
                    disabled={phone.length < 10 || !consent || loading}
                    whileTap={{ scale: 0.98 }}
                    className="w-full gradient-blue glow-blue text-primary-foreground font-bold py-4 flex items-center justify-center gap-2 disabled:opacity-40 text-[15px] tracking-wide"
                  >
                    {loading
                      ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <>Send verification code <ChevronRight className="w-4 h-4" /></>}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {step === "otp" && (
            <motion.div key="otp" className="flex flex-col flex-1"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}>

              {/* Top half hero image */}
              <div className="relative h-[46vh] min-h-[300px] overflow-hidden shadow-card">
                <AuthHeroCarousel />
                <button
                  onClick={() => { setStep("phone"); setOtp(""); }}
                  aria-label="Back"
                  className="absolute left-4 w-10 h-10 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-card"
                  style={{ top: "calc(env(safe-area-inset-top) + 0.75rem)" }}
                >
                  <ArrowLeft className="w-4 h-4 text-foreground" strokeWidth={2.4} />
                </button>
                <div className="absolute inset-x-0 bottom-0 p-6 pb-8 bg-gradient-to-t from-black/60 via-black/20 to-transparent">
                  <p className="text-white text-[28px] font-black tracking-[-0.02em] leading-tight drop-shadow-lg">Verify code</p>
                </div>
              </div>

              {/* Bottom half content */}
              <div className="flex flex-col flex-1 px-6 pb-8 pt-8">
                <h1 className="text-foreground text-[26px] leading-[1.1] font-black tracking-[-0.03em]">
                  Enter the 6-digit code
                </h1>
                <p className="text-muted-foreground text-[14px] mt-2 leading-relaxed">
                  Sent to <span className="text-foreground font-bold tabular">{country.dial} {phone}</span>{" "}
                  <button onClick={() => { setStep("phone"); setOtp(""); }} className="text-primary font-bold underline underline-offset-2 ml-1">Change</button>
                </p>

                <div className="mt-6 flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={(v) => { setOtp(v); if (otpError) setOtpError(""); }} autoFocus>
                    <InputOTPGroup className="gap-2.5">
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <InputOTPSlot
                          key={i}
                          index={i}
                          className={`w-12 h-12 !rounded-full bg-white shadow-lift border-2 !border-l-2 border-border text-foreground text-[20px] font-black tabular data-[active=true]:border-primary data-[active=true]:ring-4 data-[active=true]:ring-primary/25 ${otpError ? "ring-4 ring-destructive/30 border-destructive" : ""}`}
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {otpError && (
                  <p className="text-destructive text-[13px] text-center mt-4 font-semibold">{otpError}</p>
                )}


                <div className="mt-auto pt-6">
                  <motion.button
                    onClick={verifyOtp}
                    disabled={otp.length < 6 || loading}
                    whileTap={{ scale: 0.98 }}
                    className="w-full gradient-blue glow-blue text-primary-foreground font-bold py-4 flex items-center justify-center gap-2 disabled:opacity-40 text-[15px] tracking-wide"
                  >
                    {loading
                      ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <>Verify &amp; continue <ChevronRight className="w-4 h-4" /></>}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}


          {step === "name" && (
            <motion.div key="name" className="flex flex-col flex-1" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
              <motion.div className="mt-1 mb-6 flex flex-col items-center" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3 bbdo-card overflow-hidden">
                  <img src={logoImg} alt="Bye Bye Diabetes" className="w-12 h-12 object-cover rounded-full" />
                </div>
                <h1 className="text-foreground font-black text-[19px] tracking-tight">Welcome aboard</h1>
                <p className="text-muted-foreground text-[12px] text-center mt-1 max-w-[240px] leading-relaxed">
                  Just a couple of details to personalise your plan.
                </p>
              </motion.div>

              <h2 className="text-[22px] font-black text-foreground mb-1 tracking-tight">Tell us about you</h2>
              <p className="text-muted-foreground text-[13px] mb-5 leading-relaxed">We'll personalise your experience and send invoices to your email.</p>

              <div className="mb-4">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.18em] mb-2 ml-0.5 block">Full name</label>
                <div className="liquid-glass-input px-4 py-3.5">
                  <input type="text" placeholder="e.g. Arjun, Priya, Rahul…" value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full bg-transparent text-foreground font-medium text-base outline-none placeholder:text-muted-foreground" autoFocus />
                </div>
              </div>

              <div className="mb-6">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.18em] mb-2 ml-0.5 block">Email address</label>
                <div className={`liquid-glass-input px-4 py-3.5 ${emailError ? "border-destructive" : ""}`}>
                  <input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={emailInput}
                    onChange={(e) => { setEmailInput(e.target.value); if (emailError) setEmailError(""); }}
                    className="w-full bg-transparent text-foreground font-medium text-base outline-none placeholder:text-muted-foreground" />
                </div>
                {emailError ? (
                  <p className="text-destructive text-[12px] font-semibold mt-2 ml-0.5">{emailError}</p>
                ) : name.trim().length >= 2 && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-[12px] font-semibold mt-2 ml-0.5" style={{ color: "hsl(var(--success))" }}>
                    Hello, {name}! Let's build your health plan.
                  </motion.p>
                )}
              </div>

              <motion.button onClick={submitName} disabled={name.trim().length < 2 || !emailInput.trim() || loading}
                className="gradient-blue text-primary-foreground font-bold py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 mt-auto glow-red text-[15px] tracking-wide"
                whileTap={{ scale: 0.98 }}>
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Let's Go <ChevronRight className="w-4 h-4" /></>}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
