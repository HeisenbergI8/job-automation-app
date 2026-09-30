import { BrandMark } from "@/app/(app)/shell";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="card w-full max-w-sm p-8 sm:p-8">
        <BrandMark className="size-11" />
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Job Automation</h1>
        <p className="mt-1 mb-7 text-sm text-muted">Sign in to see every application.</p>
        <LoginForm />
      </div>
    </main>
  );
}
