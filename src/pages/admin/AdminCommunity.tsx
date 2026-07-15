import Community from "@/pages/tabs/Community";

import CsvToolbar from "@/components/admin/CsvToolbar";
/**
 * Admin Community view = same feed users see, just embedded in the admin shell.
 * Admins get full like / comment / reply functionality, plus delete-any-post
 * via the RLS admin delete policy (the PostCard already checks isAdmin).
 */
export default function AdminCommunity() {
  return (
    <div className="min-h-full bg-background">
      <div className="flex justify-end mb-3"><CsvToolbar table="community_posts" onImported={() => window.location.reload()} /></div>
      <Community />
    </div>
  );
}
