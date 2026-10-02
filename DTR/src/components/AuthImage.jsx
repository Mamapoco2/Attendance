import { useEffect, useState } from "react";
import { apiBlob } from "../../services/api";

export default function AuthImage({ attendanceId, type, alt, style }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url = null;
    let cancelled = false;

    apiBlob(`/dtr/attendances/${attendanceId}/image/${type}`)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => !cancelled && setFailed(true));

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attendanceId, type]);

  if (failed) return <span style={{ color: "#94a3b8" }}>Unavailable</span>;
  if (!src) return <span style={{ color: "#94a3b8" }}>…</span>;
  return <img src={src} alt={alt} style={style} />;
}
