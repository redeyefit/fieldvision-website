'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';

const APP_STORE_URL =
  'https://apps.apple.com/us/app/fieldvision-ai-construction/id6756640990';

export default function Home() {
  // Scroll-triggered glow effect for feature cards
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('glow-active');
          } else {
            entry.target.classList.remove('glow-active');
          }
        });
      },
      { threshold: 0.3, rootMargin: '0px 0px -100px 0px' }
    );

    document.querySelectorAll('.feature-card').forEach((card) => {
      observer.observe(card);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 md:px-12 py-4 flex justify-between items-center bg-gradient-to-b from-fv-black/95 to-transparent backdrop-blur-md">
        <Link href="/" className="flex items-center gap-3 font-display font-semibold text-lg">
          <div className="bg-white rounded-full p-1.5">
            <Image src="/logo_backup.png" alt="FieldVision" width={24} height={24} />
          </div>
          <span>FieldVision AI</span>
        </Link>
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-display font-medium text-sm px-5 py-2.5 bg-fv-blue text-white rounded-md hover:bg-transparent hover:border-fv-blue border border-transparent transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,155,217,0.3)]"
        >
          Download Free
        </a>
      </nav>

      {/* Hero Section */}
      <section className="min-h-screen flex flex-col justify-center items-center text-center px-6 pt-24 pb-16 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-full bg-[radial-gradient(ellipse_at_center_top,rgba(59,155,217,0.3)_0%,transparent_50%)] pointer-events-none" />

        <div className="mb-8 animate-fade-in-up">
          <div className="inline-block bg-white rounded-full p-8 md:p-10">
            <Image src="/logo_backup.png" alt="FieldVision AI" width={200} height={200} className="w-32 md:w-48 h-auto" />
          </div>
          <div className="font-display text-3xl md:text-5xl font-bold mt-6">FieldVision AI</div>
        </div>

        <span className="inline-flex items-center gap-2 font-display text-xs font-medium uppercase tracking-widest text-green-500 px-4 py-2 border border-green-500 rounded-full mb-8 bg-green-500/10 animate-fade-in-up animate-delay-200">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          Now on the App Store
        </span>

        <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight max-w-4xl mb-6 animate-fade-in-up animate-delay-300">
          Get home <span className="text-fv-blue">30 minutes earlier.</span>
        </h1>

        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mb-10 leading-relaxed animate-fade-in-up animate-delay-400">
          Photos, video, or voice — FieldVision fuses it all into one professional daily report in 30 seconds. Then ask the field about codes, budgets, or schedules. It knows your whole project.
        </p>

        <div className="flex flex-col items-center gap-4 animate-fade-in-up animate-delay-500">
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md sm:max-w-none">
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 font-display font-semibold px-8 py-4 bg-fv-blue text-white rounded-lg hover:bg-fv-blue-dark hover:-translate-y-0.5 hover:shadow-[0_10px_40px_rgba(59,155,217,0.3)] transition-all"
            >
              <AppleIcon />
              Download on App Store
            </a>
            <a
              href="#how-it-works"
              className="flex items-center justify-center gap-2 font-display font-semibold px-8 py-4 bg-transparent text-white border border-gray-700 rounded-lg hover:border-fv-blue hover:text-fv-blue transition-all"
            >
              <PlayIcon />
              See How It Works
            </a>
          </div>
          <p className="text-sm text-gray-500">Free to download. No credit card required.</p>
        </div>
      </section>

      {/* App Preview */}
      <section className="py-16 md:py-24 px-6 relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-2xl md:text-3xl font-semibold mb-2">Built for the Job Site</h2>
            <p className="text-gray-500">Clean, fast, and designed for one-handed use</p>
          </div>
          <div className="flex justify-center gap-4 md:gap-8 flex-wrap">
            {[
              { src: '/screenshots/01_home.png', label: 'Your Projects' },
              { src: '/screenshots/02_project_detail.png', label: 'Capture & Generate' },
              { src: '/screenshots/04_daily_report.png', label: 'AI-Generated Report' },
            ].map((phone, i) => (
              <div key={i} className="group">
                <div className="bg-gradient-to-br from-gray-900 to-black rounded-[40px] p-3 shadow-2xl hover:-translate-y-2 hover:rotate-x-5 transition-transform duration-500">
                  <Image
                    src={phone.src}
                    alt={phone.label}
                    width={280}
                    height={600}
                    className="rounded-[30px] w-40 md:w-56 lg:w-64 h-auto"
                  />
                </div>
                <p className="text-center mt-4 text-sm text-gray-500 font-medium">{phone.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-24 px-6 bg-[#111]">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="font-display text-xs font-semibold uppercase tracking-widest text-fv-blue mb-4 block">
                The Problem
              </span>
              <h2 className="font-display text-3xl md:text-4xl font-bold leading-tight mb-6">
                Documentation shouldn&apos;t be the hardest part of your job.
              </h2>
              <p className="text-gray-400 text-lg leading-relaxed mb-4">
                You&apos;re running crews, managing subs, solving problems on the fly. By the time you get home, the last thing you want to do is reconstruct what happened on site.
              </p>
              <p className="text-gray-400 text-lg leading-relaxed">
                So logs get skipped. Details get fuzzy. And when disputes arise, you&apos;re digging through texts and trying to remember what happened three months ago.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-8 bg-gray-900 rounded-2xl border border-gray-800">
              {[
                { number: '45min', label: 'Average time per daily report' },
                { number: '62%', label: 'Of supers skip logs when busy' },
                { number: '$42K', label: 'Average cost of documentation disputes' },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="font-display text-4xl font-bold text-fv-blue mb-2">{stat.number}</div>
                  <div className="text-sm text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <span className="font-display text-xs font-semibold uppercase tracking-widest text-fv-blue mb-4 block">
            How It Works
          </span>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-16">
            Three steps. Thirty seconds. Zero double-entry.
          </h2>
          <div className="grid md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-gray-800 via-fv-blue to-gray-800" />
            {[
              {
                num: 1,
                icon: <CameraIcon />,
                title: 'Walk & Capture',
                desc: "Snap photos, record a video walkthrough, or talk as you go. Tag rooms as you capture. Mix and match — use whatever's fastest.",
              },
              {
                num: 2,
                icon: <ClockIcon />,
                title: 'Generate',
                desc: 'Tap one button. AI fuses your photos, video, voice, and notes into a structured daily report. Weather included automatically.',
              },
              {
                num: 3,
                icon: <SendIcon />,
                title: 'Send',
                desc: 'Review, edit if needed, then PDF, email, or share in one tap. Done before you leave the site.',
              },
            ].map((step, i) => (
              <div key={i} className="relative p-8">
                <div className="w-12 h-12 bg-gray-900 border-2 border-fv-blue rounded-full flex items-center justify-center font-display font-bold text-xl text-fv-blue mx-auto mb-6 relative z-10">
                  {step.num}
                </div>
                <div className="w-20 h-20 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-gray-700">
                  {step.icon}
                </div>
                <h3 className="font-display text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 bg-[#111]">
        <div className="max-w-6xl mx-auto text-center">
          <span className="font-display text-xs font-semibold uppercase tracking-widest text-fv-blue mb-4 block">
            Features
          </span>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Everything you need. Nothing you don&apos;t.
          </h2>
          <p className="text-gray-500 mb-16">Built for superintendents, not IT departments.</p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            {features.map((feature, i) => (
              <div
                key={i}
                className="feature-card bg-gray-900 border border-gray-800 rounded-2xl p-8 transition-all duration-500 hover:-translate-y-1"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-fv-blue to-fv-blue-dark rounded-xl flex items-center justify-center mb-6">
                  {feature.icon}
                </div>
                <h3 className="font-display text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-gray-500 leading-relaxed mb-4">{feature.desc}</p>
                <p className="text-gray-400 italic text-sm">&ldquo;{feature.quote}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Builder Section */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-3xl p-10 relative overflow-hidden">
              <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-[radial-gradient(circle,rgba(59,155,217,0.3)_0%,transparent_70%)] opacity-50" />
              <div className="w-20 h-20 bg-fv-blue rounded-2xl flex items-center justify-center mb-8 relative">
                <HomeIcon />
              </div>
              <p className="font-display text-2xl font-medium leading-relaxed relative text-white">
                &ldquo;I&apos;ve spent too many evenings reconstructing what happened on site instead of being with my family. I built FieldVision because I needed it.&rdquo;
              </p>
            </div>
            <div>
              <span className="font-display text-xs font-semibold uppercase tracking-widest text-fv-blue mb-4 block">
                Why FieldVision
              </span>
              <h2 className="font-display text-3xl md:text-4xl font-bold leading-tight mb-6">
                Built by a GC who&apos;s done <span className="text-fv-blue">$40M+</span> in custom homes.
              </h2>
              <p className="text-gray-400 text-lg leading-relaxed mb-6">
                FieldVision isn&apos;t another tech product from people who&apos;ve never set foot on a jobsite. It&apos;s built by someone who&apos;s run crews, managed custom home projects, and knows exactly how supers work.
              </p>
              <ul className="space-y-4">
                {[
                  'Designed for how builders actually work',
                  'No complex setup or training required',
                  "Works with the photos you're already taking",
                  'AI trained on real construction workflows',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-400">
                    <CheckIcon />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="download" className="py-24 px-6 text-center relative">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[150%] h-full bg-[radial-gradient(ellipse_at_center_bottom,rgba(59,155,217,0.3)_0%,transparent_50%)] pointer-events-none" />
        <div className="max-w-4xl mx-auto relative">
          <span className="font-display text-xs font-semibold uppercase tracking-widest text-fv-blue mb-4 block">
            Get Started
          </span>
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-4">Get 30 minutes back. Every day.</h2>
          <p className="text-gray-400 text-lg mb-10 max-w-lg mx-auto">
            Download FieldVision free and experience AI-powered daily reports on your next project.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 font-display font-semibold px-8 py-4 bg-fv-blue text-white rounded-lg hover:bg-fv-blue-dark hover:-translate-y-0.5 hover:shadow-[0_10px_40px_rgba(59,155,217,0.3)] transition-all"
            >
              <AppleIcon />
              Download on App Store
            </a>
            <a
              href="mailto:steven@getfieldvision.ai?subject=FieldVision Inquiry"
              className="flex items-center justify-center gap-2 font-display font-semibold px-8 py-4 bg-transparent text-white border border-gray-700 rounded-lg hover:border-fv-blue hover:text-fv-blue transition-all"
            >
              <MailIcon />
              Contact Us
            </a>
          </div>
          <div className="flex flex-wrap justify-center gap-8 text-gray-500 text-sm">
            <div className="flex items-center gap-2">
              <PhoneIcon />
              iOS App
            </div>
            <div className="flex items-center gap-2">
              <ShieldIcon />
              Your Data Stays Private
            </div>
            <div className="flex items-center gap-2">
              <HomeSmallIcon />
              Built by a Licensed GC
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-gray-800">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 font-display font-semibold">
            <div className="bg-white rounded-full p-1">
              <Image src="/logo_backup.png" alt="FieldVision" width={18} height={18} />
            </div>
            <span>FieldVision AI</span>
          </div>
          <div className="flex gap-6 text-sm text-gray-500">
            <Link href="/privacy" className="hover:text-fv-blue transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-fv-blue transition-colors">
              Terms of Service
            </Link>
            <a href="mailto:support@getfieldvision.ai" className="hover:text-fv-blue transition-colors">
              Support
            </a>
          </div>
          <p className="text-sm text-gray-500">© 2026 FieldVision AI. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}

// Features data
const features = [
  {
    icon: <DocumentIcon />,
    title: 'AI Daily Reports in 30 Seconds',
    desc: 'Walk the site. Talk into your phone. Snap photos or record video as you go. FieldVision writes a professional daily report while you\'re still on site.',
    quote: 'I used to spend an hour after work writing reports. Now it\'s done before I leave the jobsite.',
  },
  {
    icon: <CameraIcon />,
    title: 'Capture Your Way',
    desc: 'Photos, video, voice notes, or typed text. Use one or all. Mention a punchlist item once—it auto-appears in your report, notes, AND todo list.',
    quote: 'I snap photos, ramble into my phone, and everything ends up where it needs to be.',
  },
  {
    icon: <ChatIcon />,
    title: 'Ask the Field',
    desc: 'Stuck on site? Ask about IRC egress requirements, HVAC budget, or when the inspection is. One AI that knows building codes AND your project details.',
    quote: 'Like having a code expert and PM in my pocket. I ask it 10+ questions a day.',
  },
  {
    icon: <MapPinIcon />,
    title: 'Tag Rooms As You Go',
    desc: 'Kitchen. Master bath. Garage. Tag photos and notes by location at capture time. Reports organize automatically by zone.',
    quote: 'No more scrolling through 50 photos wondering which room it was.',
  },
  {
    icon: <CloudIcon />,
    title: 'Weather Built In',
    desc: '7-day forecast for every jobsite. Alerts before bad weather hits. Conditions auto-included in every daily report.',
    quote: "Know what's coming before it costs you.",
  },
  {
    icon: <GlobeIcon />,
    title: 'English & Spanish',
    desc: 'Generate reports in both languages. Your crew reads Spanish, your PM reads English.',
    quote: "Everyone's on the same page.",
  },
];

// Icons
function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="1.5" fill="none">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="1.5" fill="none">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="1.5" fill="none">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" stroke="white" strokeWidth="2" fill="none">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" stroke="white" strokeWidth="2" fill="none">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" stroke="white" strokeWidth="2" fill="none">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function CloudIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" stroke="white" strokeWidth="2" fill="none">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" stroke="white" strokeWidth="2" fill="none">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="40" height="40" stroke="white" strokeWidth="1.5" fill="none">
      <path d="M2 20h20M5 20V10l7-7 7 7v10M9 20v-6h6v6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" stroke="#3B9BD9" strokeWidth="2" fill="none" className="flex-shrink-0 mt-0.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="1.5" fill="none">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="1.5" fill="none">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function HomeSmallIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="1.5" fill="none">
      <path d="M2 20h20M5 20V10l7-7 7 7v10" />
    </svg>
  );
}
