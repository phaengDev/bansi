import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";

/* ===================== TYPES ===================== */
export type ExportColumn<T = any> = {
    col: string;                 // Header label
    key?: string;                // data path: buyer.name_la
    export?: (row: T, index: number) => any;
    skipExport?: boolean;        // action column
    /** ຄໍລໍາລຳດັບ (ລ/ດ) — ນັບຕໍ່ເນື່ອງ (1,2,3,...) ຕາມແຖວທີ່ສົ່ງໄປ export ເທົ່ານັ້ນ */
    isSequence?: boolean;
};


/* ===================== HELPERS ===================== */
export const getByPath = (obj: any, path?: string) =>
    path?.split(".").reduce((o, k) => (o ? o[k] : ""), obj) ?? "";

export const buildRows = <T,>(data: T[], columns: ExportColumn<T>[], _skip = 0) => data?.map((row, idx) => {
    const out: Record<string, any> = {};
    columns.filter(c => !c.skipExport).forEach(c => {
        out[c.col] = c.export ? c.export(row, idx) : c.key ? getByPath(row, c.key) : ""
    });
    return out;
});


/* ===================== EXPORTS ===================== */
export const exportExcel = (rows: any[], fileName: string, title?: string) => {
    if (!rows.length) return;

    const headers = Object.keys(rows[0]);
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();

    if (title) {
        XLSX.utils.sheet_add_aoa(ws, [[title]], { origin: "A1" });

        // merge title across all columns
        ws["!merges"] = [
            {
                s: { r: 0, c: 0 },
                e: { r: 0, c: headers.length - 1 },
            },
        ];
        ws["A1"].s = {
            alignment: {
                horizontal: "center",
                vertical: "center",
            },
            font: { bold: true, sz: 14 },
        };
    }

    XLSX.utils.sheet_add_json(ws, rows, {
        origin: title ? "A2" : "A1",
        header: headers,
    });

    XLSX.utils.book_append_sheet(wb, ws, "Data");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf]), `${fileName}.xlsx`);
};
