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

/**
 * ຕື່ມຂໍ້ມູນໃສ່ແບບຟອມ Excel ທີ່ມີຢູ່ (ເຊັ່ນ public/assets/PayrollTemplate.xlsx ຂອງ BCEL i-Bank) ແລ້ວດາວໂຫຼດ —
 * ຮັກສາຊື່ sheet, ຄວາມກວ້າງຖັນ ແລະ ຮູບແບບຂອງແບບຟອມ ໃຫ້ລະບົບທະນາຄານອ່ານໄດ້ຄືເດີມ.
 * rows ຂຽນໃສ່ sheet ທຳອິດ ເລີ່ມແຖວ startRow (ຂໍ້ມູນຕົວຢ່າງໃນແບບຟອມຕັ້ງແຕ່ແຖວນັ້ນຖືກລຶບອອກ);
 * textCols = ດັດຊະນີຖັນທີ່ຕ້ອງເປັນຂໍ້ຄວາມ (ເລກບັນຊີ — Excel ຈະບໍ່ຕັດ 0 ທາງໜ້າ ຫຼື ປ່ຽນເປັນ 1.01E+17)
 */
export const exportFromTemplate = async (
    templateUrl: string,
    rows: (string | number)[][],
    fileName: string,
    { startRow = 1, textCols = [] }: { startRow?: number; textCols?: number[] } = {},
) => {
    const res = await fetch(templateUrl);
    if (!res.ok) throw new Error(`Template not found: ${templateUrl}`);
    const wb = XLSX.read(await res.arrayBuffer(), { type: "array", cellStyles: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    Object.keys(ws)
        .filter((addr) => !addr.startsWith("!") && XLSX.utils.decode_cell(addr).r >= startRow - 1)
        .forEach((addr) => delete ws[addr]);
    rows.forEach((row, i) => row.forEach((value, c) => {
        const addr = XLSX.utils.encode_cell({ r: startRow - 1 + i, c });
        ws[addr] = textCols.includes(c)
            ? { t: "s", v: String(value ?? ""), z: "@" }
            : typeof value === "number" ? { t: "n", v: value } : { t: "s", v: String(value ?? "") };
    }));
    const lastCol = Math.max(1, ...rows.map((r) => r.length)) - 1;
    ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, startRow - 2 + rows.length), c: lastCol } });
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${fileName}.xlsx`);
};
