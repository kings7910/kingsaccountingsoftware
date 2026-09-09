import {beforeEach,expect,it,vi} from "vitest";
const {createWorker}=vi.hoisted(()=>({createWorker:vi.fn()}));
vi.mock("tesseract.js",()=>({createWorker,OEM:{LSTM_ONLY:1}}));
import {recognizeReceipt} from "@/lib/receipt-ocr";
beforeEach(()=>vi.clearAllMocks());
const file=()=>new File(["photo"],"gas.png",{type:"image/png"});
it("fails gracefully if reader initialization reports an error without resolving its worker",async()=>{
 createWorker.mockImplementation((_language,_engine,options)=>{options.errorHandler("Language download failed");return new Promise(()=>{})});
 await expect(recognizeReceipt(file(),vi.fn(),new AbortController().signal)).rejects.toThrow("Receipt reader could not finish");
 expect(createWorker.mock.calls[0][2].workerPath).toContain("/receipt-ocr/7.0.0/worker.min.js");
});
it("does not start a worker for an already cancelled scan",async()=>{const controller=new AbortController();controller.abort();await expect(recognizeReceipt(file(),vi.fn(),controller.signal)).rejects.toMatchObject({name:"AbortError"});expect(createWorker).not.toHaveBeenCalled()});
it("does not start a worker for unsupported attachments",async()=>{await expect(recognizeReceipt(new File(["pdf"],"receipt.pdf",{type:"application/pdf"}),vi.fn(),new AbortController().signal)).rejects.toThrow("receipt photo");expect(createWorker).not.toHaveBeenCalled()});
