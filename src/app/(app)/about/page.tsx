import {
  BookOpen,
  Code2,
  ExternalLink,
  GraduationCap,
  Mail,
  MapPin,
  Sparkles,
  Wrench,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { AboutFeedbackForm } from "@/components/about/AboutFeedbackForm";

const profileLinks = [
  {
    href: "https://www.linkedin.com/in/upek-perera-6a41b0344/?skipRedirect=true",
    label: "LinkedIn",
    icon: ExternalLink,
  },
  {
    href: "https://github.com/Upekcapy",
    label: "GitHub",
    icon: Code2,
  },
  {
    href: "mailto:upek2007@gmail.com",
    label: "Email",
    icon: Mail,
  },
];

const education = [
  {
    school: "Toronto Metropolitan University",
    detail: "Bachelor of Science - BS, Computer Science",
    date: "Jun 2025 - Jun 2029",
  },
  {
    school: "David Suzuki Secondary School",
    detail: "Secondary School Diploma",
    date: "2021 - 2025",
  },
];

const skillGroups = [
  {
    title: "Programming languages",
    icon: Code2,
    skills: ["C++", "Java", "TypeScript", "JavaScript", "SQL", "HTML", "CSS"],
  },
  {
    title: "Tools and platforms",
    icon: Wrench,
    skills: ["Next.js", "React", "Supabase", "Vercel", "GitHub", "Finnhub API"],
  },
  {
    title: "Hard skills",
    icon: BookOpen,
    skills: [
      "Full-stack web development",
      "API integration",
      "Database design",
      "Authentication",
      "PWA notifications",
      "Responsive UI",
    ],
  },
  {
    title: "Soft skills",
    icon: Sparkles,
    skills: [
      "Problem solving",
      "Communication",
      "High Adaptivity",
      "Persistence",
      "Attention to detail",
      "User-focused thinking",
    ],
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 text-center">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="h-28 bg-[radial-gradient(circle_at_35%_0%,#c7d8dd_0,#c7d8dd_34%,#e9f1f3_35%,#e9f1f3_100%)]" />
        <div className="-mt-16 px-5 pb-7">
          <div className="mx-auto h-32 w-32 overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-sm">
            <Image
              alt="Upek Perera profile photo"
              className="h-full w-full object-cover"
              height={256}
              priority
              src="/upek-profile.png"
              width={256}
            />
          </div>

          <p className="mt-4 text-sm font-semibold text-emerald-700">NotiStock Creator</p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight text-slate-950">
            Upek Perera
          </h1>
          <p className="mt-2 text-base font-medium text-slate-700">
            TMU CS | First Year Student
          </p>
          <p className="mt-2 inline-flex items-center justify-center gap-2 text-sm text-slate-500">
            <MapPin className="h-4 w-4" />
            Brampton, Ontario, Canada
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              He/Him
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              500+ LinkedIn connections
            </span>
          </div>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-600">
            Computer Science student at Toronto Metropolitan University building practical
            software with a focus on clean interfaces, reliable data flows, and useful
            products like NotiStock.
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {profileLinks.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                  href={item.href}
                  key={item.href}
                  rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                  target={item.href.startsWith("http") ? "_blank" : undefined}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {item.href.startsWith("http") ? <ExternalLink className="h-3.5 w-3.5" /> : null}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm font-medium text-emerald-700">Educations</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
            Schooling
          </h2>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {education.map((item) => (
            <div
              className="rounded-lg border border-slate-200 p-4 text-center"
              key={item.school}
            >
              <GraduationCap className="mx-auto h-5 w-5 text-emerald-600" />
              <h3 className="mt-3 text-base font-semibold text-slate-950">{item.school}</h3>
              <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
              <p className="mt-1 text-sm font-medium text-slate-400">{item.date}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm font-medium text-emerald-700">Skills</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
            What I work with
          </h2>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {skillGroups.map((group) => {
            const Icon = group.icon;

            return (
              <div
                className="rounded-lg border border-slate-200 p-4 text-center"
                key={group.title}
              >
                <Icon className="mx-auto h-5 w-5 text-emerald-600" />
                <h3 className="mt-3 text-base font-semibold text-slate-950">{group.title}</h3>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {group.skills.map((skill) => (
                    <span
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
                      key={skill}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-emerald-700">Feedback</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
          Send a note!
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Have feedback, a bug report, an idea, or a resume opportunity? Send it
          directly to{" "}
          <a className="font-semibold text-emerald-700" href="mailto:upek2007@gmail.com">
            upek2007@gmail.com
          </a>
          .
        </p>
        <AboutFeedbackForm />
      </section>
    </div>
  );
}
