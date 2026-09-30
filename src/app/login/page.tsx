import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="mb-8 text-2xl font-semibold tracking-tight">
          Job Automation<span className="text-accent">.</span>
        </h1>
        <LoginForm />
      </div>
    </main>
  );
}
