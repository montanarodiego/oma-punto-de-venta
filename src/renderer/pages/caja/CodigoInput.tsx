import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

export interface CodigoInputHandle {
  focus(): void;
  animOk(): void;
  animError(): void;
  clear(): void;
}

export const CodigoInput = forwardRef<CodigoInputHandle, {
  onSubmit: (codigo: string) => void;
  onValueChange?: (val: string) => void;
}>(function CodigoInput({ onSubmit, onValueChange }, ref) {
  const [val, setVal]   = useState('');
  const [anim, setAnim] = useState('');
  const inputRef        = useRef<HTMLInputElement>(null);
  const scannerLastMs   = useRef(0);
  const scannerCharCnt  = useRef(0);
  const timer           = useRef<NodeJS.Timeout | null>(null);
  const onSubmitRef     = useRef(onSubmit);
  onSubmitRef.current   = onSubmit;

  useImperativeHandle(ref, () => ({
    focus:     () => setTimeout(() => inputRef.current?.focus(), 50),
    animOk:    () => { setAnim('scan-ok');    setTimeout(() => setAnim(''), 600); },
    animError: () => { setAnim('scan-error'); setTimeout(() => setAnim(''), 600); },
    clear:     () => { setVal(''); onValueChange?.(''); },
  }));

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function submit(codigo: string) {
    setVal(''); onValueChange?.('');
    onSubmitRef.current(codigo);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { submit(val); return; }
    const now = Date.now();
    const delta = now - scannerLastMs.current;
    scannerLastMs.current = now;
    if (delta < 50) scannerCharCnt.current++; else scannerCharCnt.current = 1;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setVal(v); onValueChange?.(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.length >= 3 && scannerCharCnt.current >= 3) {
      timer.current = setTimeout(() => submit(v), 120);
    }
  }

  return (
    <input
      ref={inputRef}
      value={val}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className={`flex-1 text-[16px] font-medium px-3 py-2 rounded-[var(--r)] border-2 border-accent bg-bg text-text outline-none transition-all ${anim}`}
      placeholder="Escaneá o escribí el código..."
      autoComplete="off"
      spellCheck={false}
      autoFocus
    />
  );
});
