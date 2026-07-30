"use client"

import { LoginForm } from "@/components/login-form"

export default function WebLoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* ── Left: Login Form ──────────────────────────────────────── */}
      <div className="flex flex-col p-8">
        <LoginForm
          logo={
            <svg
              className="size-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          }
          title="LinkHub"
          heading="Login"
          subtitle="Enter your email below to login to your account"
          emailPlaceholder="m@example.com"
          redirectPath="/hello"
          footer={
            <p className="text-balance text-center text-xs text-muted-foreground">
              Don&apos;t have an account?{" "}
              <a
                href="/auth/signup"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Sign up
              </a>
            </p>
          }
        />
      </div>

      {/* ── Right: Brand / Testimonial ─────────────────────────────── */}
      <div className="relative hidden flex-col items-center justify-center bg-muted p-10 text-muted-foreground lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(var(--primary)/0.08),transparent_60%)]" />
        <div className="relative z-10 flex max-w-md flex-col gap-6">
          <blockquote className="space-y-3">
            <p className="text-lg leading-relaxed text-foreground/90">
              &ldquo;This platform has saved me countless hours of work and helped me
              deliver stunning results to my clients faster than ever before.&rdquo;
            </p>
            <footer className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                SD
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Sofia Davis</p>
                <p className="text-xs">Product Designer, Acme Inc</p>
              </div>
            </footer>
          </blockquote>

          <div className="flex gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg
                key={i}
                className="size-4 fill-primary/20 text-primary/20"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Trusted by thousands of businesses worldwide.
          </p>
        </div>
      </div>
    </div>
  )
}
