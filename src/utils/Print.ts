

export const printElementByFrame = (element: HTMLElement, extraCss = "") => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    if (!doc) return;

    // สร้างโครง html/head/body
    const htmlEl = doc.createElement("html");
    const head = doc.createElement("head");
    const body = doc.createElement("body");

    // ✅ ບັງຄັບ UTF-8 ໃນ iframe — ກັນຕົວອັກສອນ ລາວ/ຈີນ ເພີ້ຍນຕອນພິມ
    const meta = doc.createElement("meta");
    meta.setAttribute("charset", "utf-8");
    head.appendChild(meta);

    // ✅ copy <link rel="stylesheet"> และ <style> จากหน้าหลัก
    const linksAndStyles = Array.from(
        document.querySelectorAll('link[rel="stylesheet"], style')
    ) as Array<HTMLLinkElement | HTMLStyleElement>;

    linksAndStyles.forEach((node) => {
        head.appendChild(node.cloneNode(true));
    });

    // ✅ ใส่ css เพิ่ม (ซ่อนปุ่ม ฯลฯ)
    const style = doc.createElement("style");
    style.innerHTML = `
    ${extraCss}
  `;
    head.appendChild(style);

    // ✅ ใส่ content ที่ต้องการพิมพ์
    body.innerHTML = element.outerHTML;

    htmlEl.appendChild(head);
    htmlEl.appendChild(body);

    doc.open();
    doc.appendChild(htmlEl);
    doc.close();

    // ✅ ພິມເມື່ອ stylesheet + font ໃນ iframe ໂຫຼດແລ້ວເທົ່ານັ້ນ — ກັນ preview ຫວ່າງເປົ່າ/ບໍ່ຂຶ້ນ
    let printed = false;
    const doPrint = () => {
        if (printed) return;
        printed = true;
        const win = iframe.contentWindow;
        if (!win) { iframe.remove(); return; }
        // ລຶບ iframe ຫຼັງ dialog ປິດ (afterprint) — ບໍ່ລຶບກ່ອນ preview ສະແດງ
        win.onafterprint = () => iframe.remove();
        win.focus();
        win.print();
        // ກັນ browser ທີ່ບໍ່ຍິງ afterprint
        setTimeout(() => iframe.remove(), 60000);
    };

    const waitFontsThenPrint = () => {
        const fonts = (iframe.contentDocument as any)?.fonts;
        if (fonts?.ready?.then) {
            fonts.ready.then(() => setTimeout(doPrint, 50));
            setTimeout(doPrint, 3000); // fallback ຖ້າ fonts.ready ຄ້າງ
        } else {
            setTimeout(doPrint, 300);
        }
    };

    if (iframe.contentDocument?.readyState === "complete") {
        waitFontsThenPrint();
    } else {
        iframe.onload = waitFontsThenPrint;
        setTimeout(waitFontsThenPrint, 1500); // fallback ຖ້າ onload ບໍ່ຍິງ
    }
};

export const onPrint = () => {
    const el = document.getElementById("print-area");
    if (!el) return;
    printElementByFrame(el, `@page { margin: 5mm; } html, body { background: #fff !important; }
      .no-print { display: none !important; } .table > tbody > tr >td {
        border: 0.3px solid black;
      }
      .table > thead > tr > th {
      border: 0.3px solid black;
      font-size: 10px !important; 
      }`
    );
  }

export const onPrintSingle = () => {
    const el = document.getElementById("print-area-single");
    if (!el) return;
    printElementByFrame(el, `@page { margin: 5mm; } html, body { background: #fff !important; }
      .no-print { display: none !important; } .table > tbody > tr >td {
        border: 0.3px solid black;
      }
      .table > thead > tr > th {
      border: 0.3px solid black;
      font-size: 14px !important; 
      }`
    );
  }

export const onPrintById = (elementId: string, extraCss = "") => {
    const el = document.getElementById(elementId);
    if (!el) return;
    printElementByFrame(el, `
      @page { margin: 5mm; }
      html, body { background: #fff !important; }
      body { font-size: 12px; }
      .no-print { display: none !important; }
      .table > tbody > tr > td,
      .table > tfoot > tr > td,
      .table > thead > tr > th,
      .table > thead > tr > td {
        border: 0.3px solid black !important;
      }
      .table-responsive {
        overflow: visible !important;
      }
      ${extraCss}
    `);
  }

export const onPrintByIdNoCss = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    printElementByFrame(el, `body { background: #fff !important; }`);
  }
