import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users, User, Handshake } from "lucide-react";
import PackageSlotsManager from "@/components/channel-partner/PackageSlotsManager";
import { useConfirm } from "@/components/ConfirmProvider";
import AvatarUploader from "@/components/admin/AvatarUploader";

interface Partner {
  id: string;
  partner_type: string;
  name: string;
  headline: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  bio: string | null;
  avatar_url: string | null;
  experience_years: number | null;
  certifications: string[] | null;
  languages: string[] | null;
  service_locations: string[] | null;
  instagram_url: string | null;
  website_url: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  is_active: boolean;
  bbdo_commission_pct: number;
  partner_commission_pct: number;
}

interface Pkg {
  id: string;
  partner_id: string;
  package_type: "group" | "private";
  name: string;
  description: string | null;
  price_inr: number;
  classes_per_month: number | null;
  duration_minutes: number | null;
  is_active: boolean;
  sort_order: number;
}

const PARTNER_TYPES = ["yoga", "dance", "meditation", "physio", "nutrition", "other"];
const listToText = (value: unknown) => (Array.isArray(value) ? value.filter(Boolean).join(", ") : "");
const textToList = (value: string | null | undefined) => (value || "").split(",").map((item) => item.trim()).filter(Boolean);

export default function AdminChannelPartners() {
  const confirm = useConfirm();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [partnerDialog, setPartnerDialog] = useState<{ open: boolean; partner: Partial<Partner> | null }>({ open: false, partner: null });
  const [pkgDialog, setPkgDialog] = useState<{ open: boolean; pkg: Partial<Pkg> | null; partnerId?: string }>({ open: false, pkg: null });

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: k }] = await Promise.all([
      supabase.from("channel_partners" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("channel_partner_packages" as any).select("*").order("sort_order", { ascending: true }),
    ]);
    setPartners((p as any) || []);
    setPackages((k as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const savePartner = async () => {
    const p = partnerDialog.partner;
    if (!p || !p.name || !p.partner_type) return toast.error("Name and type are required");
    const bbdoPct = Number(p.bbdo_commission_pct ?? 20);
    const partnerPct = Number(p.partner_commission_pct ?? 80);
    if (Math.abs(bbdoPct + partnerPct - 100) > 0.01) return toast.error("Commission split must total 100%");
    const payload = {
      partner_type: p.partner_type,
      name: p.name,
      headline: p.headline || null,
      contact_email: p.contact_email || null,
      contact_phone: p.contact_phone || null,
      bio: p.bio || null,
      avatar_url: p.avatar_url || null,
      experience_years: p.experience_years == null ? null : Number(p.experience_years),
      certifications: textToList((p as any).certificationsText ?? listToText(p.certifications)),
      languages: textToList((p as any).languagesText ?? listToText(p.languages)),
      service_locations: textToList((p as any).serviceLocationsText ?? listToText(p.service_locations)),
      instagram_url: p.instagram_url || null,
      website_url: p.website_url || null,
      address_line1: p.address_line1 || null,
      address_line2: p.address_line2 || null,
      city: p.city || null,
      state: p.state || null,
      pincode: p.pincode || null,
      bank_name: p.bank_name || null,
      bank_account_number: p.bank_account_number || null,
      bank_ifsc: p.bank_ifsc || null,
      is_active: p.is_active ?? true,
      bbdo_commission_pct: bbdoPct,
      partner_commission_pct: partnerPct,
    };
    const q = p.id
      ? await supabase.from("channel_partners" as any).update(payload).eq("id", p.id)
      : await supabase.from("channel_partners" as any).insert(payload);
    if (q.error) return toast.error(q.error.message);
    toast.success("Saved");
    setPartnerDialog({ open: false, partner: null });
    load();
  };

  const deletePartner = async (id: string) => {
    if (!(await confirm({ title: "Delete partner?", description: "This partner and all their packages will be removed.", destructive: true, confirmText: "Delete" }))) return;
    const { error } = await supabase.from("channel_partners" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const savePkg = async () => {
    const k = pkgDialog.pkg;
    const pid = k?.partner_id || pkgDialog.partnerId;
    if (!k || !pid || !k.name || !k.package_type) return toast.error("Missing fields");
    const payload = {
      partner_id: pid,
      package_type: k.package_type,
      name: k.name,
      description: k.description || null,
      price_inr: Number(k.price_inr || 0),
      classes_per_month: k.classes_per_month ? Number(k.classes_per_month) : null,
      duration_minutes: k.duration_minutes ? Number(k.duration_minutes) : null,
      is_active: k.is_active ?? true,
      sort_order: Number(k.sort_order || 0),
    };
    const q = k.id
      ? await supabase.from("channel_partner_packages" as any).update(payload).eq("id", k.id)
      : await supabase.from("channel_partner_packages" as any).insert(payload);
    if (q.error) return toast.error(q.error.message);
    toast.success("Saved");
    setPkgDialog({ open: false, pkg: null });
    load();
  };

  const deletePkg = async (id: string) => {
    if (!(await confirm({ title: "Delete package?", description: "This cannot be undone.", destructive: true, confirmText: "Delete" }))) return;
    const { error } = await supabase.from("channel_partner_packages" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2"><Handshake className="w-6 h-6 shrink-0" /> <span className="min-w-0">Channel Partner Manager</span></h1>
          <p className="text-sm text-muted-foreground mt-1">Manage external service partners (yoga, dance, and more) and their packages.</p>
        </div>
        <Button className="shrink-0 self-start sm:self-auto" onClick={() => setPartnerDialog({ open: true, partner: { partner_type: "yoga", is_active: true, bbdo_commission_pct: 20, partner_commission_pct: 80 } })}>
          <Plus className="w-4 h-4 mr-2" /> Add Partner
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : partners.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No partners yet. Add one to get started.</Card>
      ) : (
        <div className="space-y-6">
          {partners.map((p) => {
            const pkgs = packages.filter((k) => k.partner_id === p.id);
            return (
              <Card key={p.id} className="p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="w-11 h-11 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center shrink-0">
                        {p.avatar_url ? <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" /> : <span className="text-primary font-black text-sm">{p.name?.[0] ?? "P"}</span>}
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-wider">{p.partner_type}</span>
                      <h3 className="text-lg font-black">{p.name}</h3>
                      {!p.is_active && <span className="text-[11px] text-muted-foreground">(inactive)</span>}
                    </div>
                    {(p.headline || p.bio) && <p className="text-sm text-muted-foreground mt-1">{p.headline || p.bio}</p>}
                    {(p.experience_years != null || (p.languages && p.languages.length > 0)) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {p.experience_years != null && <>{p.experience_years} yrs experience </>}
                        {p.languages && p.languages.length > 0 && <>· {p.languages.join(", ")}</>}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Commission split — BBDO <b>{p.bbdo_commission_pct}%</b> · Partner <b>{p.partner_commission_pct}%</b>
                    </p>
                    {(p.contact_email || p.contact_phone) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {p.contact_email && <>✉ {p.contact_email} </>}
                        {p.contact_phone && <>· 📞 {p.contact_phone}</>}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPartnerDialog({ open: true, partner: { ...p, certificationsText: listToText(p.certifications), languagesText: listToText(p.languages), serviceLocationsText: listToText(p.service_locations) } as any })}><Pencil className="w-4 h-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => deletePartner(p.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-sm">Packages ({pkgs.length})</h4>
                    <Button size="sm" variant="ghost" onClick={() => setPkgDialog({ open: true, partnerId: p.id, pkg: { package_type: "group", is_active: true, price_inr: 0 } })}>
                      <Plus className="w-4 h-4 mr-1" /> Add Package
                    </Button>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    {pkgs.map((k) => (
                      <div key={k.id} className="rounded-xl border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {k.package_type === "group" ? <Users className="w-4 h-4 text-primary" /> : <User className="w-4 h-4 text-primary" />}
                              <span className="font-bold text-sm">{k.name}</span>
                              {!k.is_active && <span className="text-[10px] text-muted-foreground">inactive</span>}
                            </div>
                            {k.description && <p className="text-xs text-muted-foreground mt-1">{k.description}</p>}
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-xs text-muted-foreground">
                              <span>💰 ₹{k.price_inr.toLocaleString("en-IN")}/mo</span>
                              {k.classes_per_month != null && <span>📅 {k.classes_per_month} classes/mo</span>}
                              {k.duration_minutes != null && <span>⏱ {k.duration_minutes} min</span>}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setPkgDialog({ open: true, pkg: k })}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => deletePkg(k.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </div>
                        <PackageSlotsManager
                          partnerId={p.id}
                          packageId={k.id}
                          packageType={k.package_type}
                          packageName={k.name}
                          defaultDurationMin={k.duration_minutes ?? undefined}
                        />
                      </div>
                    ))}
                    {pkgs.length === 0 && <p className="text-xs text-muted-foreground col-span-full">No packages yet.</p>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Partner dialog */}
      <Dialog open={partnerDialog.open} onOpenChange={(o) => !o && setPartnerDialog({ open: false, partner: null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{partnerDialog.partner?.id ? "Edit Partner" : "Add Partner"}</DialogTitle></DialogHeader>
          {partnerDialog.partner && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={partnerDialog.partner.partner_type} onValueChange={(v) => setPartnerDialog({ open: true, partner: { ...partnerDialog.partner, partner_type: v } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PARTNER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Name</Label>
                  <Input value={partnerDialog.partner.name || ""} onChange={(e) => setPartnerDialog({ open: true, partner: { ...partnerDialog.partner, name: e.target.value } })} />
                </div>
              </div>
              <div>
                <Label>Headline</Label>
                <Input value={partnerDialog.partner.headline || ""} onChange={(e) => setPartnerDialog({ open: true, partner: { ...partnerDialog.partner, headline: e.target.value } })} placeholder="Yoga teacher · metabolic mobility" />
              </div>
              <div>
                <Label>Bio</Label>
                <Textarea rows={2} value={partnerDialog.partner.bio || ""} onChange={(e) => setPartnerDialog({ open: true, partner: { ...partnerDialog.partner, bio: e.target.value } })} />
              </div>
              <div>
                <Label>Teacher photo</Label>
                <AvatarUploader
                  value={partnerDialog.partner.avatar_url || null}
                  onChange={(url) => setPartnerDialog({ open: true, partner: { ...partnerDialog.partner, avatar_url: url } })}
                  folder="channel-partners"
                  entityId={(partnerDialog.partner as any).id || partnerDialog.partner.contact_phone || null}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Email</Label>
                  <Input value={partnerDialog.partner.contact_email || ""} onChange={(e) => setPartnerDialog({ open: true, partner: { ...partnerDialog.partner, contact_email: e.target.value } })} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={partnerDialog.partner.contact_phone || ""} onChange={(e) => setPartnerDialog({ open: true, partner: { ...partnerDialog.partner, contact_phone: e.target.value } })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Experience years</Label>
                  <Input type="number" min={0} value={partnerDialog.partner.experience_years ?? ""} onChange={(e) => setPartnerDialog({ open: true, partner: { ...partnerDialog.partner, experience_years: e.target.value === "" ? null : Number(e.target.value) } })} />
                </div>
                <div>
                  <Label>Languages</Label>
                  <Input value={(partnerDialog.partner as any).languagesText ?? listToText(partnerDialog.partner.languages)} onChange={(e) => setPartnerDialog({ open: true, partner: { ...partnerDialog.partner, languagesText: e.target.value } as any })} placeholder="Hindi, English" />
                </div>
                <div>
                  <Label>Certifications</Label>
                  <Input value={(partnerDialog.partner as any).certificationsText ?? listToText(partnerDialog.partner.certifications)} onChange={(e) => setPartnerDialog({ open: true, partner: { ...partnerDialog.partner, certificationsText: e.target.value } as any })} placeholder="RYT 200, Yoga Therapy" />
                </div>
                <div>
                  <Label>Service locations</Label>
                  <Input value={(partnerDialog.partner as any).serviceLocationsText ?? listToText(partnerDialog.partner.service_locations)} onChange={(e) => setPartnerDialog({ open: true, partner: { ...partnerDialog.partner, serviceLocationsText: e.target.value } as any })} placeholder="Online, Delhi NCR" />
                </div>
                <div>
                  <Label>Instagram</Label>
                  <Input value={partnerDialog.partner.instagram_url || ""} onChange={(e) => setPartnerDialog({ open: true, partner: { ...partnerDialog.partner, instagram_url: e.target.value } })} />
                </div>
                <div>
                  <Label>Website</Label>
                  <Input value={partnerDialog.partner.website_url || ""} onChange={(e) => setPartnerDialog({ open: true, partner: { ...partnerDialog.partner, website_url: e.target.value } })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Address line 1</Label>
                  <Input value={partnerDialog.partner.address_line1 || ""} onChange={(e) => setPartnerDialog({ open: true, partner: { ...partnerDialog.partner, address_line1: e.target.value } })} />
                </div>
                <div>
                  <Label>Address line 2</Label>
                  <Input value={partnerDialog.partner.address_line2 || ""} onChange={(e) => setPartnerDialog({ open: true, partner: { ...partnerDialog.partner, address_line2: e.target.value } })} />
                </div>
                <div>
                  <Label>City</Label>
                  <Input value={partnerDialog.partner.city || ""} onChange={(e) => setPartnerDialog({ open: true, partner: { ...partnerDialog.partner, city: e.target.value } })} />
                </div>
                <div>
                  <Label>State</Label>
                  <Input value={partnerDialog.partner.state || ""} onChange={(e) => setPartnerDialog({ open: true, partner: { ...partnerDialog.partner, state: e.target.value } })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Pincode</Label>
                  <Input value={partnerDialog.partner.pincode || ""} onChange={(e) => setPartnerDialog({ open: true, partner: { ...partnerDialog.partner, pincode: e.target.value } })} />
                </div>
                <div>
                  <Label>Bank</Label>
                  <Input value={partnerDialog.partner.bank_name || ""} onChange={(e) => setPartnerDialog({ open: true, partner: { ...partnerDialog.partner, bank_name: e.target.value } })} />
                </div>
                <div>
                  <Label>IFSC</Label>
                  <Input value={partnerDialog.partner.bank_ifsc || ""} onChange={(e) => setPartnerDialog({ open: true, partner: { ...partnerDialog.partner, bank_ifsc: e.target.value } })} />
                </div>
              </div>
              <div>
                <Label>Account number</Label>
                <Input value={partnerDialog.partner.bank_account_number || ""} onChange={(e) => setPartnerDialog({ open: true, partner: { ...partnerDialog.partner, bank_account_number: e.target.value } })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>BBDO commission %</Label>
                  <Input type="number" value={partnerDialog.partner.bbdo_commission_pct ?? 20} onChange={(e) => {
                    const v = Number(e.target.value);
                    setPartnerDialog({ open: true, partner: { ...partnerDialog.partner, bbdo_commission_pct: v, partner_commission_pct: 100 - v } });
                  }} />
                </div>
                <div>
                  <Label>Partner commission %</Label>
                  <Input type="number" value={partnerDialog.partner.partner_commission_pct ?? 80} onChange={(e) => {
                    const v = Number(e.target.value);
                    setPartnerDialog({ open: true, partner: { ...partnerDialog.partner, partner_commission_pct: v, bbdo_commission_pct: 100 - v } });
                  }} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch checked={partnerDialog.partner.is_active ?? true} onCheckedChange={(v) => setPartnerDialog({ open: true, partner: { ...partnerDialog.partner, is_active: v } })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPartnerDialog({ open: false, partner: null })}>Cancel</Button>
            <Button onClick={savePartner}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Package dialog */}
      <Dialog open={pkgDialog.open} onOpenChange={(o) => !o && setPkgDialog({ open: false, pkg: null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{pkgDialog.pkg?.id ? "Edit Package" : "Add Package"}</DialogTitle></DialogHeader>
          {pkgDialog.pkg && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={pkgDialog.pkg.package_type} onValueChange={(v: "group" | "private") => setPkgDialog({ ...pkgDialog, pkg: { ...pkgDialog.pkg, package_type: v } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="group">Group</SelectItem>
                      <SelectItem value="private">Private (1-on-1)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Name</Label>
                  <Input value={pkgDialog.pkg.name || ""} onChange={(e) => setPkgDialog({ ...pkgDialog, pkg: { ...pkgDialog.pkg, name: e.target.value } })} />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea rows={2} value={pkgDialog.pkg.description || ""} onChange={(e) => setPkgDialog({ ...pkgDialog, pkg: { ...pkgDialog.pkg, description: e.target.value } })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Price (₹/mo)</Label>
                  <Input type="number" value={pkgDialog.pkg.price_inr ?? 0} onChange={(e) => setPkgDialog({ ...pkgDialog, pkg: { ...pkgDialog.pkg, price_inr: Number(e.target.value) } })} />
                </div>
                <div>
                  <Label>Classes / month</Label>
                  <Input type="number" value={pkgDialog.pkg.classes_per_month ?? ""} onChange={(e) => setPkgDialog({ ...pkgDialog, pkg: { ...pkgDialog.pkg, classes_per_month: e.target.value === "" ? null : Number(e.target.value) } })} />
                </div>
                <div>
                  <Label>Duration (min)</Label>
                  <Input type="number" value={pkgDialog.pkg.duration_minutes ?? ""} onChange={(e) => setPkgDialog({ ...pkgDialog, pkg: { ...pkgDialog.pkg, duration_minutes: e.target.value === "" ? null : Number(e.target.value) } })} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch checked={pkgDialog.pkg.is_active ?? true} onCheckedChange={(v) => setPkgDialog({ ...pkgDialog, pkg: { ...pkgDialog.pkg, is_active: v } })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPkgDialog({ open: false, pkg: null })}>Cancel</Button>
            <Button onClick={savePkg}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
