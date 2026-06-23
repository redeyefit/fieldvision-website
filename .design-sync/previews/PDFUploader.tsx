import { PDFUploader } from 'fieldvision-web';

// PDFUploader is the contract-ingest dropzone for the schedule tool. It lives
// on the dark FieldVision shell, so each cell supplies that background.
const noop = async () => {};

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      background: '#0A0A0A',
      padding: 24,
      width: 460,
      fontFamily: "'Space Grotesk', system-ui, sans-serif",
    }}
  >
    {children}
  </div>
);

/** The idle drop target — drag a PDF or click to browse. */
export const Empty = () => (
  <Frame>
    <PDFUploader onUpload={noop} />
  </Frame>
);

/** After a contract has been uploaded, with the "View" link row. */
export const Uploaded = () => (
  <Frame>
    <PDFUploader onUpload={noop} pdfUrl="https://blob.example.com/contracts/oak-st-remodel.pdf" />
  </Frame>
);

/** Disabled while another action is in flight. */
export const Disabled = () => (
  <Frame>
    <PDFUploader onUpload={noop} disabled />
  </Frame>
);
