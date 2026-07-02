import { useCallback, useState } from "react";

let _nextId = 0;

export function useToast(duration = 3200) {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, type = "success") => {
    const id = ++_nextId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, [duration]);

  return { toasts, show };
}
