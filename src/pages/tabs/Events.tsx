import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { CalendarDays, MapPin, Globe, IndianRupee, Users, X, Ticket, PartyPopper } from "lucide-react";
import {
  listUpcomingEvents,
  listMyRegistrations,
  registerForEvent,
  cancelEventRegistration,
  formatEventWhen,
  type EventRow,
  type EventRegistrationRow,
} from "@/lib/eventsService";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import EventPaymentModal from "@/components/events/EventPaymentModal";

type SubTab = "discover" | "mine";

export default function Events() {
  const [tab, setTab] = useState<SubTab>("discover");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [mine, setMine] = useState<Array<EventRegistrationRow & { event: EventRow }>>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ev, my] = await Promise.all([listUpcomingEvents(), listMyRegistrations()]);
      setEvents(ev);
      setMine(my);
    } catch (e: any) {
      toast({ title: "Couldn't load events", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const registeredIds = new Set(
    mine.filter((m) => m.status === "registered" || m.status === "waitlisted").map((m) => m.event_id),
  );

  const handleRegister = async (ev: EventRow) => {
    try {
      const reg = await registerForEvent(ev.id);
      toast({
        title: reg.status === "waitlisted" ? "Added to waitlist" : "You're in!",
        description:
          reg.payment_status === "pending"
            ? `Complete ₹${ev.fee_inr} payment to confirm your seat.`
            : `${ev.title} — see you there.`,
      });
      await load();
    } catch (e: any) {
      toast({ title: "Registration failed", description: e.message, variant: "destructive" });
    }
  };

  const handleCancel = async (ev: EventRow) => {
    try {
      await cancelEventRegistration(ev.id);
      toast({ title: "Registration cancelled" });
      await load();
    } catch (e: any) {
      toast({ title: "Cancel failed", description: e.message, variant: "destructive" });
    }
  };

  const myActive = mine.filter((m) => m.status === "registered" || m.status === "waitlisted");

  return (
    <div className="px-4 sm:px-6 pt-4 pb-24 space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-black text-foreground">Events</h1>
        <p className="text-sm text-muted-foreground">
          Workshops, meetups & wellness gatherings — book your spot.
        </p>
      </header>

      <div className="inline-flex rounded-full border bg-muted/40 p-1">
        {(["discover", "mine"] as SubTab[]).map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${
              tab === s
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "discover" ? "Discover" : `My Events${myActive.length ? ` (${myActive.length})` : ""}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">Loading events…</div>
      ) : tab === "discover" ? (
        events.length === 0 ? (
          <EmptyDiscover />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {events.map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                registered={registeredIds.has(ev.id)}
                onRegister={() => handleRegister(ev)}
                onCancel={() => handleCancel(ev)}
              />
            ))}
          </div>
        )
      ) : myActive.length === 0 ? (
        <EmptyMine onDiscover={() => setTab("discover")} />
      ) : (
        <div className="space-y-3">
          {myActive.map((m) => (
            <MyEventRow key={m.id} reg={m} onCancel={() => handleCancel(m.event)} />
          ))}
        </div>
      )}
    </div>
  );
}

function EventCard({
  event,
  registered,
  onRegister,
  onCancel,
}: {
  event: EventRow;
  registered: boolean;
  onRegister: () => void;
  onCancel: () => void;
}) {
  const full = event.capacity != null && event.registered_count >= event.capacity;
  const seatsLeft = event.capacity != null ? Math.max(event.capacity - event.registered_count, 0) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border bg-card overflow-hidden shadow-sm"
    >
      {event.cover_image_url ? (
        <img src={event.cover_image_url} alt={event.title} className="w-full h-40 object-cover" />
      ) : (
        <div className="w-full h-24 bg-gradient-to-br from-[var(--bbdo-blue-soft)] to-[var(--bbdo-red)]/10 flex items-center justify-center">
          <PartyPopper className="w-10 h-10 text-[var(--bbdo-blue)]" />
        </div>
      )}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-foreground leading-tight">{event.title}</h3>
          <span
            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
              event.is_paid && event.fee_inr > 0
                ? "bg-[var(--bbdo-red)]/10 text-[var(--bbdo-red)]"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {event.is_paid && event.fee_inr > 0 ? `₹${event.fee_inr}` : "Free"}
          </span>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" /> {formatEventWhen(event.starts_at, event.timezone)}
          </div>
          <div className="flex items-center gap-1.5">
            {event.mode === "online" ? (
              <>
                <Globe className="w-3.5 h-3.5" /> Online event
              </>
            ) : (
              <>
                <MapPin className="w-3.5 h-3.5" />
                <span className="truncate">
                  {event.venue_name || event.venue_city || "Venue TBA"}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {event.capacity == null
              ? "Unlimited seats"
              : full
                ? "Full — join waitlist"
                : `${seatsLeft} seat${seatsLeft === 1 ? "" : "s"} left`}
          </div>
        </div>

        {event.description && (
          <p className="text-xs text-foreground/70 line-clamp-2">{event.description}</p>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="text-[11px] text-muted-foreground truncate">by {event.organizer_name}</div>
          {registered ? (
            <button
              onClick={onCancel}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border text-muted-foreground hover:text-destructive hover:border-destructive"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={onRegister}
              className="text-xs font-bold px-4 py-1.5 rounded-full text-white"
              style={{ background: "var(--bbdo-red)" }}
            >
              {full ? "Waitlist" : "Register"}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function MyEventRow({
  reg,
  onCancel,
}: {
  reg: EventRegistrationRow & { event: EventRow };
  onCancel: () => void;
}) {
  const ev = reg.event;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border bg-card p-4 flex gap-3 items-start"
    >
      <div className="w-14 h-14 shrink-0 rounded-xl bg-[var(--bbdo-blue-soft)] flex items-center justify-center">
        <Ticket className="w-6 h-6 text-[var(--bbdo-blue)]" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <h4 className="font-bold text-foreground truncate">{ev.title}</h4>
          {reg.status === "waitlisted" && (
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              Waitlist
            </span>
          )}
          {reg.payment_status === "pending" && (
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[var(--bbdo-red)]/10 text-[var(--bbdo-red)]">
              Pay ₹{ev.fee_inr}
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5" /> {formatEventWhen(ev.starts_at, ev.timezone)}
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          {ev.mode === "online" ? (
            <>
              <Globe className="w-3.5 h-3.5" />
              {ev.online_url ? (
                <a href={ev.online_url} target="_blank" rel="noreferrer" className="underline truncate">
                  Join link
                </a>
              ) : (
                "Online — link coming soon"
              )}
            </>
          ) : (
            <>
              <MapPin className="w-3.5 h-3.5" />
              <span className="truncate">
                {[ev.venue_name, ev.venue_city].filter(Boolean).join(", ") || "Venue TBA"}
              </span>
            </>
          )}
        </div>
      </div>
      <button
        onClick={onCancel}
        aria-label="Cancel registration"
        className="p-2 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

function EmptyDiscover() {
  return (
    <div className="rounded-2xl border border-dashed p-10 text-center space-y-2">
      <PartyPopper className="w-10 h-10 mx-auto text-[var(--bbdo-blue)]" />
      <h3 className="font-bold">No events on the calendar yet</h3>
      <p className="text-sm text-muted-foreground">
        Check back soon — new workshops and meetups drop regularly.
      </p>
    </div>
  );
}

function EmptyMine({ onDiscover }: { onDiscover: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed p-10 text-center space-y-3">
      <Ticket className="w-10 h-10 mx-auto text-[var(--bbdo-red)]" />
      <h3 className="font-bold">Oops — no events yet!</h3>
      <p className="text-sm text-muted-foreground">
        You haven't registered for anything. Let's find you something great to join.
      </p>
      <button
        onClick={onDiscover}
        className="mt-2 text-sm font-bold px-5 py-2 rounded-full text-white"
        style={{ background: "var(--bbdo-red)" }}
      >
        Browse events
      </button>
    </div>
  );
}
