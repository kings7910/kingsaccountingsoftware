# Receipt auto-fill

In **Fuel & mileage → Record fuel**, choose **Scan to auto-fill** on a supported phone, or **Upload photo to auto-fill**. Use a clear JPEG, PNG, or WebP photo up to 4 MB. The reader supports printed English receipts and USD amounts. PDF receipts can still be attached through the existing receipt panel; PDF text recognition is not included.

Review the suggested vendor, purchase date, total, and gallons. Edit any incorrect suggestions, then choose **Apply suggestions**. This updates the form without saving it. Complete the truck unit, odometer, and other required fields, and save. The photo is attached to the saved fuel entry. If only the photo upload fails, the fuel entry remains saved and the receipt panel offers **Attach scanned photo to this entry**; it does not create another fuel purchase.

In **Driver → Fuel**, the reader suggests vendor, total, and gallons. Driver submissions keep their existing submission date and offline queue behavior. After submitting, select the matching fuel entry explicitly and choose **Attach scanned photo to this entry**. A scanned photo remains only in the current page's memory until attached. If offline, reconnect and synchronize the fuel entry before attaching. Receipt photos are not part of the persistent offline queue.

The OCR engine runs in a browser worker using Tesseract.js. Worker, language, and WebAssembly assets are served from this site, not a third-party OCR service. The first scan downloads the reader assets and may take longer. Scanning has cancellation and a one-minute time limit. Recognition may misread photographs; it never saves or posts accounting records automatically. Conflicting totals are left blank, and recognizable non-USD currencies require manual amount entry. Tax may be displayed for review but is not added again to the receipt total.

## Build assets

`npm run dev` and `npm run build` prepare `public/receipt-ocr/7.0.0/` from pinned npm packages. Generated assets are excluded from Git. Keep the preparation script and package lock together when upgrading the reader.

Third-party components:

- [Tesseract.js](https://github.com/naptha/tesseract.js), Apache-2.0; its license is copied into the generated asset directory.
- [Tesseract.js-core](https://github.com/naptha/tesseract.js-core), Apache-2.0; its license is also copied.
- [English language data package](https://www.npmjs.com/package/@tesseract.js-data/eng), version 1.0.0; its package metadata declares MIT licensing. The package's `4.0.0_best_int` data is used.
