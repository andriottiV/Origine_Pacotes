"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { X } from "lucide-react";

export default function Dialog({ title, children, onClose, returnFocusRef }: { title: string; children: ReactNode; onClose: () => void; returnFocusRef?: RefObject<HTMLElement | null> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const dismiss = useRef(onClose);
  useEffect(() => { dismiss.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = returnFocusRef?.current || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const node = dialog.current;
    node?.showModal();
    return () => { node?.close(); previous?.focus(); };
  }, [returnFocusRef]);
  return <dialog ref={dialog} className="dialog native-dialog" aria-label={title} onKeyDown={event => {
    if (event.key !== "Tab") return;
    const controls = event.currentTarget.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]');
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }} onCancel={event => { event.preventDefault(); dismiss.current(); }} onClick={event => { if (event.target === event.currentTarget) dismiss.current(); }}>
    <div className="dialog-inner"><header className="dialog-header"><h2>{title}</h2><button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X aria-hidden="true" size={20} /></button></header>{children}</div>
  </dialog>;
}
