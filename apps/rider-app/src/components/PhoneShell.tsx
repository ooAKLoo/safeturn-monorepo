import type { ReactNode } from "react";

export function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#dce6f2] px-3 py-4 text-slate-100 sm:grid sm:place-items-center">
      <div className="phone-shell min-h-[860px] w-full max-w-[430px] overflow-hidden rounded-[28px] border-[10px] border-slate-950 bg-[#07111d] shadow-phone">
        {children}
      </div>
    </main>
  );
}
