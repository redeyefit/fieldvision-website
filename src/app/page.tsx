'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const APP_STORE_URL =
  'https://apps.apple.com/us/app/fieldvision-ai-construction/id6756640990';

// ─── Cursor glow ───
function useCursorGlow() {
  useEffect(() => {
    const glow = document.createElement('div');
    glow.className = 'cursor-glow';
    document.body.appendChild(glow);
    const move = (e: MouseEvent) => {
      glow.style.left = e.clientX + 'px';
      glow.style.top = e.clientY + 'px';
    };
    window.addEventListener('mousemove', move);
    return () => { window.removeEventListener('mousemove', move); glow.remove(); };
  }, []);
}

// ─── Counter ───
function Counter({ target, suffix = '', prefix = '' }: { target: string; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(prefix + '0' + suffix);
  const triggered = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !triggered.current) {
        triggered.current = true;
        const num = parseInt(target.replace(/[^0-9]/g, ''));
        const duration = 2000;
        const start = performance.now();
        const animate = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplay(prefix + Math.round(num * eased) + suffix);
          if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, suffix, prefix]);

  return <span ref={ref}>{display}</span>;
}

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const promisesRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<HTMLDivElement>(null);
  const mosaicRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [navVisible, setNavVisible] = useState(false);
  const [activeSection, setActiveSection] = useState(0);

  useCursorGlow();

  // Loading screen
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
      setTimeout(() => setLoaded(true), 100);
    }, 2400);
    return () => clearTimeout(timer);
  }, []);

  // Nav on scroll
  useEffect(() => {
    const onScroll = () => setNavVisible(window.scrollY > window.innerHeight * 0.5);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lenis + GSAP
  useEffect(() => {
    if (!loaded) return;

    const init = async () => {
      const gsapModule = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      const Lenis = (await import('lenis')).default;
      const gsap = gsapModule.default;
      gsap.registerPlugin(ScrollTrigger);

      // ── LENIS: Smooth scroll ──
      const lenis = new Lenis({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });

      // Connect Lenis → ScrollTrigger
      lenis.on('scroll', ScrollTrigger.update);

      // Drive Lenis from GSAP's ticker for perfect sync
      gsap.ticker.add((time: number) => {
        lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);

      // Store for cleanup
      (window as unknown as Record<string, unknown>).__lenis = lenis;

      // ── Shared easing — consistent feel, but animations run on their own clock ──
      const EASE_IN = 'power2.out';
      const EASE_OUT = 'power2.in';

      // ── HERO: Video plays freely, scroll controls text overlay ──
      if (heroRef.current) {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: heroRef.current,
            start: 'top top',
            end: '+=200%',
            pin: true,
            scrub: 0.3,
          },
        });

        tl
          .to('.hero-badge', { opacity: 0, y: -30, duration: 0.2 }, 0.15)
          .to('.hero-h1', { opacity: 0, y: -50, duration: 0.25 }, 0.2)
          .to('.hero-p', { opacity: 0, y: -30, duration: 0.2 }, 0.25)
          .to('.hero-actions', { opacity: 0, y: -20, duration: 0.2 }, 0.3)
          .to('.hero-video-overlay', { opacity: 0.15, duration: 0.3 }, 0.25)
          // Promise text sequence
          .fromTo('.promise-1', { opacity: 0 }, { opacity: 1, duration: 0.1 }, 0.4)
          .to('.promise-1', { opacity: 0, duration: 0.1 }, 0.55)
          .fromTo('.promise-2', { opacity: 0 }, { opacity: 1, duration: 0.1 }, 0.6)
          .to('.promise-2', { opacity: 0, duration: 0.1 }, 0.75)
          // Fade to black
          .to('.hero-fade', { opacity: 1, duration: 0.2 }, 0.85);
      }

      // ── PROMISE SECTIONS: Scroll pins the view. Content staggers in independently. ──
      const sections = document.querySelectorAll('.promise-section');
      sections.forEach((section, i) => {
        const line = section.querySelector('.ps-line');
        const header = section.querySelector('.ps-header');
        const label = section.querySelector('.ps-label');
        const headline = section.querySelector('.ps-headline');
        const desc = section.querySelector('.ps-desc');
        const phone = section.querySelector('.ps-phone');

        // Initial state — each piece hidden separately
        gsap.set([header, label, headline, desc], { opacity: 0, y: 40 });
        gsap.set(phone, { opacity: 0, y: 60, scale: 0.95 });
        if (line) gsap.set(line, { scaleX: 0 });

        const animateIn = () => {
          const tl = gsap.timeline();
          if (line) tl.to(line, { scaleX: 1, duration: 1.2, ease: 'power2.inOut' }, 0);
          tl.to(header, { opacity: 1, y: 0, duration: 0.5, ease: EASE_IN }, 0)
            .to(label, { opacity: 1, y: 0, duration: 0.4, ease: EASE_IN }, 0.15)
            .to(headline, { opacity: 1, y: 0, duration: 0.6, ease: EASE_IN }, 0.25)
            .to(desc, { opacity: 1, y: 0, duration: 0.5, ease: EASE_IN }, 0.4)
            .to(phone, { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: EASE_IN }, 0.3);
        };

        ScrollTrigger.create({
          trigger: section,
          start: 'top top',
          end: '+=150%',
          pin: true,
          onEnter: () => { setActiveSection(i + 1); animateIn(); },
          onLeave: () => {
            gsap.to([header, label, headline, desc], { opacity: 0, y: -30, duration: 0.4, ease: EASE_OUT, stagger: 0.04 });
            gsap.to(phone, { opacity: 0, y: -40, scale: 0.95, duration: 0.5, ease: EASE_OUT });
          },
          onEnterBack: () => { setActiveSection(i + 1); animateIn(); },
          onLeaveBack: () => {
            gsap.to([header, label, headline, desc], { opacity: 0, y: 40, duration: 0.4, ease: EASE_OUT });
            gsap.to(phone, { opacity: 0, y: 60, scale: 0.95, duration: 0.5, ease: EASE_OUT });
            if (line) gsap.to(line, { scaleX: 0, duration: 0.3 });
          },
        });
      });

      // ── MOSAIC: Time-driven staggered reveal ──
      if (mosaicRef.current) {
        const items = mosaicRef.current.querySelectorAll('.mosaic-item');
        gsap.set(items, { opacity: 0, y: 60, scale: 0.92 });
        ScrollTrigger.create({
          trigger: mosaicRef.current,
          start: 'top 75%',
          onEnter: () => {
            gsap.to(items, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: EASE_IN, stagger: 0.12 });
          },
          onLeaveBack: () => {
            gsap.to(items, { opacity: 0, y: 60, scale: 0.92, duration: 0.4, ease: EASE_OUT });
          },
        });
      }

      // ── Generic reveals — time-driven, triggered by scroll position ──
      document.querySelectorAll('.reveal').forEach((el) => {
        gsap.set(el, { opacity: 0, y: 50 });
        ScrollTrigger.create({
          trigger: el,
          start: 'top 85%',
          onEnter: () => {
            gsap.to(el, { opacity: 1, y: 0, duration: 0.8, ease: EASE_IN });
          },
          onLeaveBack: () => {
            gsap.to(el, { opacity: 0, y: 50, duration: 0.4, ease: EASE_OUT });
          },
        });
      });
    };

    init();
    return () => {
      const lenis = (window as unknown as Record<string, unknown>).__lenis as { destroy: () => void } | undefined;
      if (lenis) lenis.destroy();
      import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
        ScrollTrigger.getAll().forEach((t) => t.kill());
      });
    };
  }, [loaded]);

  return (
    <div>
      {/* ═══ LOADING ═══ */}
      <div className={`fixed inset-0 z-[200] bg-fv-black flex flex-col items-center justify-center transition-all duration-1000 ${loading ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="mb-8">
          <div className="bg-white rounded-2xl p-3 shadow-[0_0_60px_rgba(255,255,255,0.06)]">
            <Image src="/logo_backup.png" alt="FieldVision" width={48} height={48} className="animate-pulse" />
          </div>
        </div>
        <div className="w-48 h-[2px] bg-white/[0.06] rounded-full overflow-hidden mb-6">
          <div className="h-full bg-gradient-to-r from-fv-blue to-fv-blue-light rounded-full animate-loading-bar" />
        </div>
        <p className="font-display text-sm tracking-[0.3em] uppercase text-gray-500">Building your experience</p>
      </div>

      {/* ═══ NAV — Appears on scroll ═══ */}
      <nav className={`fixed top-0 left-0 right-0 z-[100] px-3 md:px-10 py-3 md:py-4 transition-all duration-700 ${navVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center bg-black/60 backdrop-blur-2xl border border-white/[0.06] rounded-xl md:rounded-2xl px-4 md:px-5 py-2.5 md:py-3">
          <Link href="/" className="flex items-center gap-2 font-display font-semibold text-sm tracking-tight">
            <div className="bg-white rounded-lg md:rounded-xl p-1 md:p-1.5">
              <Image src="/logo_backup.png" alt="FieldVision" width={20} height={20} className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <span className="hidden sm:inline">FieldVision</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            {['Capture', 'Generate', 'Send', 'Ask'].map((item, i) => (
              <a key={item} href={`#section-${i + 1}`} className={`font-display text-[11px] font-medium tracking-[0.15em] uppercase transition-colors duration-300 ${activeSection === i + 1 ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                {item}
              </a>
            ))}
          </div>
          <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="font-display text-[11px] md:text-xs font-semibold px-4 md:px-5 py-2 md:py-2.5 bg-white text-black rounded-lg md:rounded-xl hover:bg-gray-100 transition-all duration-300">
            Download
          </a>
        </div>
      </nav>

      {/* ═══ HERO — Full-bleed video ═══ */}
      <section ref={heroRef} className="h-screen relative flex items-end overflow-hidden">
        {/* Video */}
        <div className="hero-video absolute inset-0">
          <video ref={heroVideoRef} autoPlay muted loop playsInline preload="auto" className="w-full h-full object-cover" onLoadedMetadata={(e) => { (e.target as HTMLVideoElement).playbackRate = 0.6; }}>
            <source src="/hero.mp4" type="video/mp4" />
          </video>
        </div>

        {/* Overlays */}
        <div className="hero-video-overlay absolute inset-0 bg-fv-black/55 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-fv-black/80 via-transparent to-fv-black/30 pointer-events-none" />
        <div className="hero-fade absolute inset-0 bg-fv-black opacity-0 pointer-events-none" />

        {/* Hero content — left aligned like Valmont */}
        <div className="hero-content relative z-10 w-full px-6 md:px-16 pb-24 md:pb-32">
          <div className="hero-badge mb-4 md:mb-6">
            <span className="inline-flex items-center gap-2 text-[10px] md:text-[11px] font-display font-semibold uppercase tracking-[0.25em] md:tracking-[0.3em] text-green-400 px-3 md:px-4 py-1.5 md:py-2 border border-green-400/20 rounded-full bg-green-500/[0.06]">
              <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-full w-full bg-green-400" />
              </span>
              Live on the App Store
            </span>
          </div>

          <h1 className="hero-h1 font-display text-[clamp(2.5rem,8vw,6.5rem)] font-bold leading-[0.92] tracking-[-0.03em] max-w-4xl mb-4 md:mb-6">
            Get Home<br />
            <span className="text-fv-blue">30 Minutes Earlier.</span>
          </h1>

          <p className="hero-p text-base md:text-xl text-gray-300 max-w-lg mb-8 md:mb-10 leading-relaxed font-light">
            AI-powered daily reports from photos, video, and voice. Built for the field.
          </p>

          <div className="hero-actions flex flex-col sm:flex-row gap-3 md:gap-4">
            <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="font-display font-semibold text-sm md:text-base px-6 md:px-8 py-3.5 md:py-4 bg-white text-black rounded-2xl hover:shadow-[0_0_60px_rgba(255,255,255,0.15)] transition-all duration-500 flex items-center justify-center gap-2.5">
              <AppleIcon /> Download Free
            </a>
            <a href="#section-1" className="font-display font-medium text-sm md:text-base px-6 md:px-8 py-3.5 md:py-4 text-white border border-white/20 rounded-2xl hover:bg-white/10 transition-all duration-500 text-center">
              Explore
            </a>
          </div>
        </div>

        {/* Promise text overlays (appear during scroll) */}
        <div className="promise-1 absolute inset-0 flex items-center justify-center z-20 pointer-events-none opacity-0">
          <p className="font-display text-[clamp(2rem,5vw,4.5rem)] font-bold tracking-tight text-center leading-tight">
            It&apos;s more than an app.
          </p>
        </div>
        <div className="promise-2 absolute inset-0 flex items-center justify-center z-20 pointer-events-none opacity-0">
          <p className="font-display text-[clamp(2rem,5vw,4.5rem)] font-bold tracking-tight text-center leading-tight">
            It&apos;s a promise.
          </p>
        </div>

        {/* Bottom bar */}
        <div className="absolute bottom-0 left-0 right-0 z-30 px-4 md:px-16 py-4 md:py-5 flex justify-between items-center border-t border-white/[0.06]">
          <span className="font-display text-[9px] md:text-[10px] font-semibold tracking-[0.2em] uppercase text-gray-500">FieldVision</span>
          <span className="font-display text-[9px] md:text-[10px] tracking-[0.15em] md:tracking-[0.2em] uppercase text-gray-500 hidden sm:block">Built for the field.</span>
          <span className="font-display text-[9px] md:text-[10px] tracking-[0.15em] md:tracking-[0.2em] uppercase text-gray-500 flex items-center gap-1.5">
            Scroll
            <svg className="w-3 h-3 animate-bounce" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
          </span>
        </div>
      </section>

      {/* ═══ PROMISE SECTIONS — Full-bleed numbered ═══ */}
      {[
        {
          id: 'section-1',
          num: '01',
          category: 'Capture',
          promise: 'To end the era of forgotten field notes.',
          desc: 'Photos, video, voice — tag rooms as you walk. One-handed, on the move. Everything you capture goes straight into your report.',
          screenshot: '/screenshots/01_home.png',
          bgImage: '/section-01.webp',
        },
        {
          id: 'section-2',
          num: '02',
          category: 'Generate',
          promise: 'To give you back your evenings.',
          desc: 'One tap. AI fuses photos, video, voice, and notes into a structured daily report. Weather and zones included. Done in 30 seconds.',
          screenshot: '/screenshots/02_project_detail.png',
          bgImage: '/section-02.webp',
        },
        {
          id: 'section-3',
          num: '03',
          category: 'Send',
          promise: 'To make every report bulletproof.',
          desc: 'Review, edit, then PDF, email, or share. Professional documentation that protects you when disputes arise. Done before you leave the site.',
          screenshot: '/screenshots/04_daily_report.png',
          bgImage: '/section-03.webp',
        },
        {
          id: 'section-4',
          num: '04',
          category: 'Ask',
          promise: 'To put codes, budgets, and schedules in your pocket.',
          desc: 'IRC egress requirements. HVAC budget. Inspection dates. One AI that knows building codes AND your entire project history.',
          screenshot: '/screenshots/03_project_sections.png',
          bgImage: '/section-04.webp',
        },
      ].map((section, i) => (
        <section
          key={i}
          id={section.id}
          className="promise-section min-h-screen relative flex items-center bg-fv-black overflow-hidden"
        >
          {/* Full-bleed construction photography */}
          <Image src={section.bgImage} alt="" fill className="object-cover opacity-30" priority={i === 0} />
          <div className="absolute inset-0 bg-gradient-to-r from-fv-black/80 via-fv-black/50 to-transparent" />

          {/* Content — two column: text left, phone right */}
          <div className="ps-content relative z-10 w-full px-6 md:px-16 py-16 md:py-24">
            {/* Number + Category + Progress line */}
            <div className="ps-header flex items-center gap-4 md:gap-6 mb-8 md:mb-12">
              <span className="font-display text-[10px] md:text-[11px] font-medium tracking-[0.2em] text-gray-600">{section.num}</span>
              <div className="ps-line h-[1px] w-24 md:w-80 bg-white/20 origin-left" />
              <span className="font-display text-[10px] md:text-[11px] font-semibold tracking-[0.2em] md:tracking-[0.25em] uppercase text-gray-400">{section.category}</span>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-10 md:gap-20">
              {/* Text side */}
              <div className="md:flex-1 md:max-w-xl">
                <div className="ps-label mb-3 md:mb-4">
                  <span className="font-display text-[9px] md:text-[10px] font-medium tracking-[0.25em] md:tracking-[0.3em] uppercase text-fv-blue">It&apos;s a promise</span>
                </div>
                <h2 className="ps-headline font-display text-[clamp(1.5rem,5vw,4rem)] font-bold leading-[1.1] tracking-tight mb-5 md:mb-8">
                  {section.promise}
                </h2>
                <p className="ps-desc text-gray-400 text-base md:text-lg leading-relaxed max-w-xl">
                  {section.desc}
                </p>
              </div>

              {/* Phone side — larger, intentional */}
              <div className="ps-phone md:flex-shrink-0">
                <div className="bg-gradient-to-b from-[#2a2a2e] to-[#1a1a1e] rounded-[36px] md:rounded-[44px] p-[3px] md:p-[5px] shadow-[0_30px_80px_rgba(0,0,0,0.7)] border border-white/[0.06]">
                  <div className="bg-black rounded-[33px] md:rounded-[40px] p-[2px]">
                    <Image
                      src={section.screenshot}
                      alt={section.category}
                      width={300}
                      height={640}
                      className="rounded-[31px] md:rounded-[38px] w-44 md:w-56 lg:w-64 h-auto"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="absolute bottom-0 left-0 right-0 z-30 px-4 md:px-16 py-4 md:py-5 flex justify-between items-center border-t border-white/[0.04]">
            <span className="font-display text-[9px] md:text-[10px] font-semibold tracking-[0.2em] uppercase text-gray-600">FieldVision</span>
            <span className="font-display text-[9px] md:text-[10px] tracking-[0.15em] md:tracking-[0.2em] uppercase text-gray-600 hidden sm:block">Built for the field.</span>
            <span className="font-display text-[9px] md:text-[10px] tracking-[0.15em] md:tracking-[0.2em] uppercase text-gray-600 flex items-center gap-1.5">
              Scroll
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
            </span>
          </div>
        </section>
      ))}

      {/* ═══ STATS ═══ */}
      <section className="relative py-24 md:py-40 px-6 bg-fv-black">
        <div className="max-w-5xl mx-auto">
          <div className="reveal text-center mb-20">
            <span className="font-display text-[10px] font-semibold tracking-[0.3em] uppercase text-red-400/80 block mb-5">The Problem</span>
            <h2 className="font-display text-[clamp(2rem,5vw,4rem)] font-bold leading-[1.1] tracking-tight">
              Documentation shouldn&apos;t<br />cost you your evenings.
            </h2>
          </div>

          <div className="reveal grid md:grid-cols-3 gap-4 mb-20">
            {[
              { num: '45', suffix: 'min', prefix: '', label: 'Per report, manually', color: 'from-red-500/10' },
              { num: '62', suffix: '%', prefix: '', label: 'Of supers skip logs', color: 'from-orange-500/10' },
              { num: '42', suffix: 'K', prefix: '$', label: 'Avg dispute cost', color: 'from-yellow-500/10' },
            ].map((stat, i) => (
              <div key={i} className={`group text-center p-10 rounded-3xl bg-gradient-to-b ${stat.color} to-transparent border border-white/[0.04]`}>
                <div className="font-display text-[clamp(3rem,6vw,5rem)] font-bold text-white mb-2 tracking-tight">
                  <Counter target={stat.num} suffix={stat.suffix} prefix={stat.prefix} />
                </div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="reveal max-w-2xl mx-auto text-center">
            <p className="text-gray-400 text-lg leading-relaxed">
              You&apos;re solving problems on the fly. By the time you get home, the last thing you want to do is write a report.
              <span className="text-white font-medium"> FieldVision does it for you.</span>
            </p>
          </div>
        </div>
      </section>

      {/* ═══ PHOTO MOSAIC ═══ */}
      <section className="relative py-20 md:py-32 px-6 bg-fv-black overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

        {/* Curved connecting lines (SVG) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.04]" viewBox="0 0 1200 800" fill="none">
          <path d="M0 400 Q300 200 600 400 Q900 600 1200 400" stroke="white" strokeWidth="1" />
          <path d="M0 500 Q400 300 800 500 Q1000 600 1200 450" stroke="white" strokeWidth="1" />
        </svg>

        <div ref={mosaicRef} className="max-w-6xl mx-auto">
          {/* Mosaic — 3 phones, clean and centered */}
          <div className="flex justify-center gap-4 md:gap-10 flex-wrap mb-12 md:mb-16">
            {[
              { src: '/screenshots/01_home.png', label: 'Your Projects' },
              { src: '/screenshots/02_project_detail.png', label: 'Capture & Generate' },
              { src: '/screenshots/04_daily_report.png', label: 'AI Report' },
            ].map((phone, i) => (
              <div key={i} className="mosaic-item">
                <div className="bg-gradient-to-b from-[#2a2a2e] to-[#1a1a1e] rounded-[44px] p-[5px] shadow-[0_40px_80px_rgba(0,0,0,0.6)] border border-white/[0.04]">
                  <div className="bg-black rounded-[40px] p-[2px]">
                    <Image
                      src={phone.src}
                      alt={phone.label}
                      width={260}
                      height={560}
                      className="rounded-[38px] w-28 sm:w-36 md:w-52 h-auto"
                    />
                  </div>
                </div>
                <p className="text-center mt-5 text-xs text-gray-500 font-display tracking-wide uppercase">{phone.label}</p>
              </div>
            ))}
          </div>

          {/* Center tagline */}
          <div className="reveal text-center py-16">
            <h2 className="font-display text-[clamp(2rem,5vw,4rem)] font-bold tracking-tight leading-tight mb-6">
              Get Home Earlier.<br />
              <span className="text-fv-blue">Build Better.</span>
            </h2>
            <div className="flex items-center justify-center gap-3 text-gray-500 text-sm">
              <span className="w-8 h-px bg-white/10" />
              <span className="font-display text-[10px] tracking-[0.3em] uppercase">Built for the field.</span>
              <span className="w-8 h-px bg-white/10" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ BUILDER ═══ */}
      <section className="relative py-24 md:py-40 px-6 bg-fv-black">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

        <div className="max-w-4xl mx-auto">
          <div className="reveal relative bg-white/[0.02] border border-white/[0.04] rounded-2xl md:rounded-3xl p-6 md:p-16 overflow-hidden">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-fv-blue/[0.04] rounded-full blur-[100px]" />
            <div className="mb-8">
              <span className="font-display text-[10px] font-semibold tracking-[0.3em] uppercase text-fv-blue">The Builder</span>
            </div>
            <blockquote className="relative font-display text-lg md:text-3xl font-medium leading-relaxed text-white/90 mb-8 md:mb-10">
              &ldquo;I&apos;ve spent too many evenings reconstructing what happened on site instead of being with my family. I built FieldVision because I needed it — and because every super I know needed it too.&rdquo;
            </blockquote>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-fv-blue to-fv-blue-dark rounded-xl flex items-center justify-center shadow-lg shadow-fv-blue/20">
                <HomeIcon />
              </div>
              <div>
                <div className="font-display font-bold text-sm">Steven Fernandez</div>
                <div className="text-gray-500 text-xs">Licensed GC &middot; $40M+ Custom Homes &middot; Founder</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="relative py-24 md:py-52 px-6 text-center bg-fv-black overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,155,217,0.06)_0%,transparent_50%)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-32 bg-gradient-to-b from-transparent via-fv-blue/20 to-transparent" />

        <div className="max-w-3xl mx-auto relative">
          <div className="reveal">
            <h2 className="font-display text-[clamp(2.5rem,7vw,5.5rem)] font-bold tracking-tight leading-[0.95] mb-8">
              Get 30 minutes back.<br />
              <span className="bg-gradient-to-r from-fv-blue to-fv-blue-light bg-clip-text text-transparent">Every single day.</span>
            </h2>
            <p className="text-gray-400 text-xl mb-14 max-w-md mx-auto">
              Your next daily report takes 30 seconds.
            </p>

            <div className="flex flex-col sm:flex-row gap-5 justify-center mb-16">
              <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="font-display font-semibold px-8 md:px-14 py-4 md:py-5 bg-white text-black rounded-2xl text-base md:text-lg hover:shadow-[0_0_80px_rgba(255,255,255,0.12)] transition-all duration-500 flex items-center justify-center gap-3">
                <AppleIcon /> Download on App Store
              </a>
              <Link href="/schedule" className="font-display font-semibold px-8 md:px-14 py-4 md:py-5 text-white border border-white/10 rounded-2xl text-base md:text-lg hover:bg-white/5 transition-all duration-500 text-center">
                Try Schedule Maker
              </Link>
            </div>

            <div className="flex flex-wrap justify-center gap-10 text-gray-600 text-sm">
              <span className="flex items-center gap-2"><PhoneIcon /> iOS App</span>
              <span className="flex items-center gap-2"><ShieldIcon /> Data Stays Private</span>
              <span className="flex items-center gap-2"><HomeSmallIcon /> Licensed GC Built</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="py-12 px-6 border-t border-white/[0.03] bg-fv-black">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2.5 font-display font-semibold text-sm tracking-tight">
            <div className="bg-white rounded-xl p-1.5">
              <Image src="/logo_backup.png" alt="FieldVision" width={18} height={18} />
            </div>
            FieldVision AI
          </div>
          <div className="flex gap-8 text-sm text-gray-600">
            <Link href="/privacy" className="hover:text-white transition-colors duration-300">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors duration-300">Terms</Link>
            <a href="mailto:support@getfieldvision.ai" className="hover:text-white transition-colors duration-300">Support</a>
          </div>
          <p className="text-xs text-gray-700">© 2026 MyndAIX Inc.</p>
        </div>
      </footer>
    </div>
  );
}

// ─── Icons ───
function AppleIcon() {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>;
}
function HomeIcon() {
  return <svg viewBox="0 0 24 24" width="20" height="20" stroke="white" strokeWidth="2" fill="none"><path d="M2 20h20M5 20V10l7-7 7 7v10M9 20v-6h6v6" /></svg>;
}
function PhoneIcon() {
  return <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="1.5" fill="none"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>;
}
function ShieldIcon() {
  return <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="1.5" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
}
function HomeSmallIcon() {
  return <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="1.5" fill="none"><path d="M2 20h20M5 20V10l7-7 7 7v10" /></svg>;
}
