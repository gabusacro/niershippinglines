export function CrewTicketScanner() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const toast = useToast();

  /* ---------------- VALIDATE ---------------- */

  const validateTicket = async (payload: string) => {
    setLoading(true);

    try {
      const res = await fetch(
        `/api/crew/validate-ticket?payload=${encodeURIComponent(payload)}`
      );

      const data = await res.json();

      if (!res.ok) {
        toast.showError(data.error ?? "Invalid ticket");
        return;
      }

      setResult(data);
    } catch {
      toast.showError("Validation failed");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- START CAMERA ---------------- */

  const startScan = async () => {
    try {
      setResult(null);

      /** ✅ IMPORTANT — SHOW CONTAINER FIRST */
      setScanning(true);

      await new Promise((r) => setTimeout(r, 200));

      const html5QrCode = new Html5Qrcode("qr-reader");
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 5,
          qrbox: { width: 260, height: 260 },
        },
        (decodedText) => {
          stopScan();
          validateTicket(decodedText);
        }
      );
    } catch (err: any) {
      setScanning(false);
      toast.showError(
        "Camera failed. Allow camera permission in browser."
      );
    }
  };

  /* ---------------- STOP CAMERA ---------------- */

  const stopScan = async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch {}

    setScanning(false);
  };

  useEffect(() => {
    return () => {
      stopScan();
    };
  }, []);

  /* ---------------- UI ---------------- */

  return (
    <div className="space-y-4">

      {/* START BUTTON */}
      {!scanning && (
        <button
          onClick={startScan}
          className="w-full rounded-xl bg-[#0c7b93] px-4 py-3 text-white font-bold"
        >
          📷 Scan QR Code
        </button>
      )}

      {/* ✅ CAMERA ALWAYS EXISTS WHEN SCANNING */}
      {scanning && (
        <div className="space-y-3">

          {/* VERY IMPORTANT HEIGHT */}
          <div
            id="qr-reader"
            className="w-full min-h-[320px] rounded-xl border-2 border-teal-400 overflow-hidden"
          />

          <button
            onClick={stopScan}
            className="w-full rounded-xl border px-4 py-2"
          >
            Stop scanning
          </button>
        </div>
      )}

      {/* RESULT */}
      {loading && (
        <p className="text-center animate-pulse">
          Validating ticket...
        </p>
      )}

      {result && (
        <div className="rounded-xl border p-4">
          <p className="font-bold text-lg">
            {result.passenger_name}
          </p>

          <p>Status: {result.status}</p>

          <button
            onClick={() => setResult(null)}
            className="mt-3 border px-3 py-1 rounded"
          >
            Scan another
          </button>
        </div>
      )}
    </div>
  );
}