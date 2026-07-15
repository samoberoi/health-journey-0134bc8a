import { useState } from "react";
import ExportCsvButton from "./ExportCsvButton";
import ImportCsvButton from "./ImportCsvButton";
import { fetchAllRows } from "@/lib/csvIo";
import { toast } from "sonner";

interface Props {
  /** Supabase table for both export (full fetch) and import (upsert). */
  table: string;
  /** File name stem for the CSV. Defaults to the table name. */
  filename?: string;
  /** PK to upsert on. Default `id`. */
  pk?: string;
  /** Optional order column when exporting. */
  orderBy?: string;
  /** Called after a successful import so the page can refetch. */
  onImported?: () => void;
  className?: string;
}

/**
 * One-stop Export + Import strip. Exports fetch every row from `table`;
 * imports upsert by `pk`. Use this on admin pages that don't already
 * pass a `rows` array to ExportCsvButton.
 */
export default function CsvToolbar({ table, filename, pk = "id", orderBy, onImported, className = "" }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <ExportCsvButton
        filename={filename ?? table}
        rows={async () => {
          try {
            const data = await fetchAllRows(table, orderBy);
            setRows(data);
            return data;
          } catch (e: any) {
            toast.error(e?.message || "Export failed");
            return [];
          }
        } as any}
      />
      <ImportCsvButton table={table} pk={pk} onImported={onImported} />
    </div>
  );
}
