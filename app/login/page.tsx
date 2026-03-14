import { Suspense } from "react";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { AuthForm } from "./AuthForm";
import Link from "next/link";

export const metadata = {
  title: "Sign In",
  description: `Sign in or create account — ${APP_NAME}`,
};

export default function LoginPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">

      {/* ── Tropical Siargao background ── */}
      <div className="absolute inset-0 z-0">
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 1200 900"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid slice"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
          <defs>
            <style>{`
              @keyframes shimmer{0%,100%{opacity:.6}50%{opacity:1}}
              @keyframes sway1{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(4deg)}}
              @keyframes sway2{0%,100%{transform:rotate(2deg)}50%{transform:rotate(-4deg)}}
              @keyframes sway3{0%,100%{transform:rotate(-1deg)}50%{transform:rotate(3deg)}}
              @keyframes foamPulse{0%,100%{opacity:.4}50%{opacity:.85}}
              @keyframes boatBob{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-6px) rotate(1deg)}}
              @keyframes cloudDrift{0%{transform:translateX(0)}100%{transform:translateX(80px)}}
              .shimmer{animation:shimmer 4s ease-in-out infinite}
              .foam{animation:foamPulse 3s ease-in-out infinite}
              .boat1{animation:boatBob 4s ease-in-out infinite}
              .boat2{animation:boatBob 5.5s ease-in-out infinite 1.2s}
              .cloud1{animation:cloudDrift 22s linear infinite}
              .cloud2{animation:cloudDrift 30s linear infinite 6s}
              .palm1{transform-origin:340px 680px;animation:sway1 5s ease-in-out infinite}
              .palm2{transform-origin:400px 660px;animation:sway2 6s ease-in-out infinite 0.8s}
              .palm3{transform-origin:270px 700px;animation:sway3 4.5s ease-in-out infinite 1.5s}
              .palm4{transform-origin:920px 640px;animation:sway1 5.5s ease-in-out infinite 0.5s}
              .palm5{transform-origin:980px 658px;animation:sway2 4.8s ease-in-out infinite 1.2s}
              .palm6{transform-origin:860px 655px;animation:sway3 5.2s ease-in-out infinite 2s}
            `}</style>
          </defs>

          {/* Sky */}
          <rect x="0" y="0" width="1200" height="900" fill="#A8D8EA"/>
          <rect x="0" y="0" width="1200" height="300" fill="#C9E8F5" opacity="0.6"/>
          <rect x="0" y="0" width="1200" height="120" fill="#E8F4FD" opacity="0.7"/>

          {/* Sun top right */}
          <circle cx="1050" cy="90" r="100" fill="#FFF3CD" opacity="0.35"/>
          <circle cx="1050" cy="90" r="65" fill="#FFD966" opacity="0.5"/>
          <circle cx="1050" cy="90" r="42" fill="#FFC107" opacity="0.75"/>

          {/* Clouds */}
          <g className="cloud1">
            <ellipse cx="180" cy="80" rx="80" ry="24" fill="white" opacity="0.75"/>
            <ellipse cx="220" cy="65" rx="58" ry="30" fill="white" opacity="0.8"/>
            <ellipse cx="140" cy="85" rx="44" ry="18" fill="white" opacity="0.65"/>
          </g>
          <g className="cloud2">
            <ellipse cx="550" cy="55" rx="65" ry="19" fill="white" opacity="0.6"/>
            <ellipse cx="588" cy="44" rx="46" ry="24" fill="white" opacity="0.65"/>
          </g>

          {/* Distant horizon water */}
          <rect x="0" y="280" width="1200" height="80" fill="#1A7A9E" opacity="0.9"/>
          <rect x="0" y="330" width="1200" height="50" fill="#1090B8" opacity="0.65"/>

          {/* Main turquoise ocean */}
          <rect x="0" y="360" width="1200" height="540" fill="#00B4D8"/>
          <rect x="0" y="360" width="1200" height="540" fill="#0096C7" opacity="0.45"/>

          {/* Deep water patches */}
          <ellipse cx="150" cy="460" rx="200" ry="90" fill="#0077B6" opacity="0.45"/>
          <ellipse cx="1050" cy="440" rx="180" ry="80" fill="#0077B6" opacity="0.4"/>
          <ellipse cx="600" cy="520" rx="320" ry="110" fill="#0096C7" opacity="0.3"/>
          <ellipse cx="80" cy="580" rx="130" ry="60" fill="#00B4D8" opacity="0.35"/>
          <ellipse cx="1130" cy="600" rx="140" ry="65" fill="#00B4D8" opacity="0.3"/>

          {/* Shallow brilliant teal near shore */}
          <ellipse cx="350" cy="710" rx="380" ry="160" fill="#48CAE4" opacity="0.65"/>
          <ellipse cx="820" cy="695" rx="340" ry="140" fill="#48CAE4" opacity="0.55"/>
          <ellipse cx="590" cy="780" rx="500" ry="130" fill="#90E0EF" opacity="0.5"/>

          {/* Island landmass — organic aerial shape */}
          <path d="M100 750 Q180 620 320 590 Q460 560 580 568 Q720 575 840 595 Q940 612 1000 650 Q1060 688 1080 740 Q1060 790 980 820 Q860 860 680 875 Q480 888 310 865 Q175 845 120 800 Q85 772 100 750Z" fill="#2D6A2D"/>

          {/* Vegetation layers */}
          <path d="M160 720 Q250 640 400 615 Q540 592 660 600 Q790 608 880 632 Q960 655 980 700 Q990 735 950 768 Q880 808 740 828 Q580 845 420 838 Q270 830 190 790 Q145 762 160 720Z" fill="#1E5E1E"/>
          <path d="M220 728 Q310 660 460 638 Q598 618 710 626 Q830 635 900 662 Q950 680 945 718 Q920 758 820 780 Q680 800 530 796 Q375 791 275 758 Q225 738 220 728Z" fill="#276B27"/>
          <path d="M280 735 Q370 678 510 658 Q645 640 755 650 Q860 660 900 688 Q930 706 918 738 Q890 770 780 786 Q645 800 500 796 Q360 792 300 762 Q275 748 280 735Z" fill="#338A33"/>

          {/* Tree canopy clusters */}
          {[
            [330,645,32,22],[390,628,26,19],[455,618,28,20],[525,612,24,18],
            [595,615,26,19],[660,620,28,20],[720,628,24,18],[775,638,26,19],
            [830,652,22,17],[360,662,20,15],[430,642,18,14],[500,632,20,15],
            [570,628,18,14],[635,635,20,15],[695,645,18,14],[748,655,20,15],
            [800,668,18,14],[845,680,16,12]
          ].map(([cx,cy,rx,ry],i) => (
            <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry}
              fill={i%3===0?"#1A5C1A":i%3===1?"#247A24":"#2D8A2D"} opacity={0.75+i%2*0.05}/>
          ))}

          {/* White sand beach */}
          <path d="M130 808 Q220 768 380 752 Q540 738 660 744 Q790 750 900 768 Q980 785 1040 812 Q1010 848 920 866 Q790 892 610 900 Q420 908 270 888 Q165 872 130 808Z" fill="#F5E6C8"/>
          <path d="M158 818 Q242 782 400 768 Q558 754 675 760 Q800 767 895 783 Q965 798 995 820 Q965 848 880 864 Q755 886 590 892 Q415 898 275 878 Q185 862 158 818Z" fill="#FAF0DC"/>

          {/* Wet sand near water line */}
          <path d="M185 848 Q310 828 470 820 Q620 813 760 820 Q870 827 940 845 Q900 862 800 870 Q660 880 510 878 Q360 876 250 862 Q205 854 185 848Z" fill="#E8D4A8" opacity="0.55"/>

          {/* PALM TREES left cluster */}
          <g className="palm3">
            <path d="M270 700 Q268 686 267 672 Q268 658 270 645 Q271 632 270 620" stroke="#4A3520" strokeWidth="6" fill="none" strokeLinecap="round"/>
            <path d="M270 622 Q248 600 229 605" stroke="#2D6E2D" strokeWidth="5" fill="none" strokeLinecap="round"/>
            <path d="M270 622 Q256 594 262 575" stroke="#338A33" strokeWidth="5" fill="none" strokeLinecap="round"/>
            <path d="M270 622 Q290 596 312 603" stroke="#2D6E2D" strokeWidth="5" fill="none" strokeLinecap="round"/>
            <path d="M270 622 Q285 608 302 613" stroke="#247A24" strokeWidth="4" fill="none" strokeLinecap="round"/>
            <path d="M270 622 Q252 610 236 616" stroke="#338A33" strokeWidth="4" fill="none" strokeLinecap="round"/>
            <circle cx="272" cy="626" r="5" fill="#5C4010"/>
            <circle cx="280" cy="631" r="4.5" fill="#4A3520"/>
          </g>
          <g className="palm1">
            <path d="M340 680 Q338 664 337 648 Q338 632 340 616 Q342 600 340 586" stroke="#3D2A14" strokeWidth="7" fill="none" strokeLinecap="round"/>
            <path d="M340 588 Q316 562 294 568" stroke="#2D6E2D" strokeWidth="6" fill="none" strokeLinecap="round"/>
            <path d="M340 588 Q324 558 330 537" stroke="#338A33" strokeWidth="6" fill="none" strokeLinecap="round"/>
            <path d="M340 588 Q364 560 388 568" stroke="#2D6E2D" strokeWidth="6" fill="none" strokeLinecap="round"/>
            <path d="M340 588 Q358 572 378 578" stroke="#247A24" strokeWidth="5" fill="none" strokeLinecap="round"/>
            <path d="M340 588 Q320 575 302 580" stroke="#338A33" strokeWidth="5" fill="none" strokeLinecap="round"/>
            <circle cx="342" cy="592" r="6" fill="#5C4010"/>
            <circle cx="352" cy="598" r="5" fill="#4A3520"/>
            <circle cx="334" cy="597" r="4.5" fill="#5C4010"/>
          </g>
          <g className="palm2">
            <path d="M400 660 Q398 646 397 632 Q398 618 400 604 Q401 590 400 578" stroke="#4A3520" strokeWidth="6" fill="none" strokeLinecap="round"/>
            <path d="M400 580 Q378 556 358 562" stroke="#2D6E2D" strokeWidth="5" fill="none" strokeLinecap="round"/>
            <path d="M400 580 Q386 552 392 533" stroke="#338A33" strokeWidth="5" fill="none" strokeLinecap="round"/>
            <path d="M400 580 Q422 554 444 562" stroke="#2D6E2D" strokeWidth="5" fill="none" strokeLinecap="round"/>
            <path d="M400 580 Q416 566 434 572" stroke="#247A24" strokeWidth="4" fill="none" strokeLinecap="round"/>
            <circle cx="402" cy="584" r="5.5" fill="#5C4010"/>
            <circle cx="410" cy="589" r="4.5" fill="#4A3520"/>
          </g>

          {/* PALM TREES right cluster */}
          <g className="palm6">
            <path d="M860 655 Q858 640 857 625 Q858 610 860 596 Q861 582 860 570" stroke="#4A3520" strokeWidth="6" fill="none" strokeLinecap="round"/>
            <path d="M860 572 Q838 548 818 554" stroke="#2D6E2D" strokeWidth="5" fill="none" strokeLinecap="round"/>
            <path d="M860 572 Q846 544 852 525" stroke="#338A33" strokeWidth="5" fill="none" strokeLinecap="round"/>
            <path d="M860 572 Q880 546 900 554" stroke="#2D6E2D" strokeWidth="5" fill="none" strokeLinecap="round"/>
            <path d="M860 572 Q874 558 890 564" stroke="#247A24" strokeWidth="4" fill="none" strokeLinecap="round"/>
            <circle cx="862" cy="576" r="5" fill="#5C4010"/>
          </g>
          <g className="palm4">
            <path d="M920 640 Q918 622 917 604 Q918 586 920 568 Q922 550 920 535" stroke="#3D2A14" strokeWidth="7" fill="none" strokeLinecap="round"/>
            <path d="M920 537 Q896 510 873 517" stroke="#2D6E2D" strokeWidth="6" fill="none" strokeLinecap="round"/>
            <path d="M920 537 Q904 506 910 484" stroke="#338A33" strokeWidth="6" fill="none" strokeLinecap="round"/>
            <path d="M920 537 Q944 508 968 516" stroke="#2D6E2D" strokeWidth="6" fill="none" strokeLinecap="round"/>
            <path d="M920 537 Q940 520 960 526" stroke="#247A24" strokeWidth="5" fill="none" strokeLinecap="round"/>
            <path d="M920 537 Q900 522 882 528" stroke="#338A33" strokeWidth="5" fill="none" strokeLinecap="round"/>
            <circle cx="922" cy="541" r="6" fill="#5C4010"/>
            <circle cx="932" cy="547" r="5" fill="#4A3520"/>
          </g>
          <g className="palm5">
            <path d="M980 658 Q978 643 977 628 Q978 613 980 598 Q982 583 980 570" stroke="#4A3520" strokeWidth="6" fill="none" strokeLinecap="round"/>
            <path d="M980 572 Q959 548 940 554" stroke="#2D6E2D" strokeWidth="5" fill="none" strokeLinecap="round"/>
            <path d="M980 572 Q966 544 972 525" stroke="#338A33" strokeWidth="5" fill="none" strokeLinecap="round"/>
            <path d="M980 572 Q1000 546 1022 554" stroke="#2D6E2D" strokeWidth="5" fill="none" strokeLinecap="round"/>
            <path d="M980 572 Q996 558 1014 564" stroke="#247A24" strokeWidth="4" fill="none" strokeLinecap="round"/>
            <circle cx="982" cy="576" r="5.5" fill="#5C4010"/>
            <circle cx="990" cy="581" r="4.5" fill="#4A3520"/>
          </g>

          {/* Wave foam on shore */}
          <path className="foam" d="M120 800 Q280 778 480 770 Q680 762 880 772 Q1020 780 1100 800" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.7"/>
          <path className="foam" style={{animationDelay:"1.2s"}} d="M145 825 Q310 806 510 798 Q700 791 890 800 Q1010 808 1075 825" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.45"/>

          {/* Water shimmer */}
          <g className="shimmer">
            <path d="M80 420 Q200 412 300 420" stroke="white" strokeWidth="2" fill="none" opacity="0.35" strokeLinecap="round"/>
            <path d="M700 405 Q820 398 920 405" stroke="white" strokeWidth="1.5" fill="none" opacity="0.3" strokeLinecap="round"/>
            <path d="M350 475 Q500 467 620 475" stroke="white" strokeWidth="1.5" fill="none" opacity="0.3" strokeLinecap="round"/>
            <path d="M880 460 Q980 453 1080 460" stroke="white" strokeWidth="1.5" fill="none" opacity="0.28" strokeLinecap="round"/>
            <path d="M100 540 Q220 533 330 540" stroke="white" strokeWidth="1.2" fill="none" opacity="0.22" strokeLinecap="round"/>
            <path d="M820 520 Q920 514 1020 520" stroke="white" strokeWidth="1.2" fill="none" opacity="0.25" strokeLinecap="round"/>
          </g>

          {/* Boats */}
          <g className="boat1" style={{transformOrigin:"760px 540px"}}>
            <path d="M720 538 Q735 525 785 525 Q810 527 816 538 Q800 552 720 550Z" fill="#8B4513" stroke="#6B3410" strokeWidth="1.5"/>
            <path d="M742 527 Q752 514 762 525" stroke="#DEB887" strokeWidth="2.5" fill="none"/>
            <rect x="754" y="508" width="3" height="19" fill="#5C3010"/>
            <path d="M757 508 L776 518 L757 526Z" fill="#E8D5A3" opacity="0.9"/>
            <path d="M720 550 Q768 558 816 550" stroke="#7A3E0E" strokeWidth="0.8" fill="none" opacity="0.4"/>
          </g>
          <g className="boat2" style={{transformOrigin:"550px 568px"}}>
            <path d="M518 566 Q530 554 568 554 Q588 556 592 566 Q578 580 518 577Z" fill="#6B3E26" stroke="#5C3020" strokeWidth="1.5"/>
            <rect x="540" y="547" width="2.5" height="18" fill="#4A2810"/>
            <path d="M542 547 L558 556 L542 563Z" fill="#D4C4A0" opacity="0.9"/>
          </g>

          {/* Tiny people on beach */}
          <ellipse cx="540" cy="852" rx="4" ry="8" fill="#8B6914" opacity="0.65"/>
          <ellipse cx="556" cy="855" rx="3.5" ry="7" fill="#7A5C10" opacity="0.6"/>
          <ellipse cx="610" cy="848" rx="4" ry="7.5" fill="#8B6914" opacity="0.62"/>
          <ellipse cx="628" cy="851" rx="3.5" ry="7" fill="#7A5C10" opacity="0.58"/>
          <ellipse cx="670" cy="850" rx="4" ry="7" fill="#8B6914" opacity="0.6"/>

          {/* Beach umbrella */}
          <line x1="592" y1="840" x2="592" y2="866" stroke="#8B4513" strokeWidth="2"/>
          <ellipse cx="592" cy="840" rx="14" ry="5" fill="#E74C3C" opacity="0.85"/>
          <ellipse cx="592" cy="840" rx="14" ry="5" fill="#E74C3C" opacity="0.3" transform="rotate(30 592 840)"/>

          {/* Boat wake trails */}
          <path d="M816 542 Q840 539 862 545 Q840 550 816 550" stroke="white" strokeWidth="1.5" fill="none" opacity="0.45"/>
          <path d="M592 570 Q614 567 634 572 Q614 576 592 577" stroke="white" strokeWidth="1.2" fill="none" opacity="0.38"/>

          {/* Dark overlay for text/form readability */}
          <rect x="0" y="0" width="1200" height="900" fill="#0C3040" opacity="0.32"/>

          {/* Vignette */}
          <rect x="0" y="0" width="100" height="900" fill="#071828" opacity="0.35"/>
          <rect x="1100" y="0" width="100" height="900" fill="#071828" opacity="0.35"/>
          <rect x="0" y="0" width="1200" height="60" fill="#071828" opacity="0.2"/>
          <rect x="0" y="840" width="1200" height="60" fill="#071828" opacity="0.2"/>
        </svg>
      </div>

      {/* ── Site name top left ── */}
      <div className="absolute top-6 left-8 z-20">
        <Link href={ROUTES.home} className="flex items-center gap-2">
          <span className="text-white font-bold text-lg tracking-wide drop-shadow-md">
            🏝 Travela Siargao
          </span>
        </Link>
      </div>

      {/* ── Floating tagline ── */}
      <div className="absolute top-6 right-8 z-20 hidden sm:block">
        <span className="text-white/80 text-sm font-medium drop-shadow">
          Ferry Booking · Siargao Island
        </span>
      </div>

      {/* ── Form card — centered over background ── */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* Glassmorphism card */}
          <div
            className="rounded-2xl border border-white/30 p-8 shadow-2xl"
            style={{
              background: "rgba(255, 255, 255, 0.92)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            {/* Top accent bar */}
            <div className="mb-6 flex items-center gap-3">
              <div className="h-1 flex-1 rounded-full bg-[#0c7b93]"/>
              <span className="text-xs font-bold uppercase tracking-widest text-[#0c7b93]">
                Travela Siargao
              </span>
              <div className="h-1 flex-1 rounded-full bg-[#0c7b93]"/>
            </div>

            <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-teal-100" />}>
              <AuthForm />
            </Suspense>
          </div>

          {/* Back to home — below card */}
          <div className="mt-4 text-center">
            <Link
              href={ROUTES.home}
              className="text-sm font-semibold text-white/90 hover:text-white underline underline-offset-4 drop-shadow"
            >
              ← Back to home
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
