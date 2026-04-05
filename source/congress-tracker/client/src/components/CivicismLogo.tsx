/** Inline SVG logo — uses currentColor so it adapts to dark/light theme */
export default function CivicismLogo({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1000 248"
      fill="none"
      stroke="none"
      className={className}
      style={style}
      aria-label="Civicism"
      role="img"
    >
      <g stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Finial/spire */}
        <line x1="148" y1="10"  x2="148" y2="33" strokeWidth="1.4"/>
        <polyline points="144.5,18 148,10 151.5,18" strokeWidth="1.1"/>
        <line x1="145.8" y1="18" x2="150.2" y2="18" strokeWidth="1.0"/>
        <line x1="145.4" y1="23" x2="150.6" y2="23" strokeWidth="1.0"/>
        <line x1="145.0" y1="28" x2="151.0" y2="28" strokeWidth="1.0"/>

        {/* Globe */}
        <ellipse cx="148" cy="38" rx="5.5" ry="5" strokeWidth="1.3"/>

        {/* Lantern drum */}
        <path d="M138.5,48 Q148,43 157.5,48" strokeWidth="1.2"/>
        <line x1="138.5" y1="48" x2="136.5" y2="62" strokeWidth="1.2"/>
        <line x1="157.5" y1="48" x2="159.5" y2="62" strokeWidth="1.2"/>
        <line x1="136.5" y1="62" x2="159.5" y2="62" strokeWidth="1.3"/>
        <line x1="139.8" y1="48.5" x2="138.5" y2="61.5" strokeWidth="0.72"/>
        <line x1="142.1" y1="47.4" x2="140.9" y2="61.5" strokeWidth="0.72"/>
        <line x1="144.4" y1="46.8" x2="143.4" y2="61.5" strokeWidth="0.72"/>
        <line x1="146.7" y1="46.4" x2="145.9" y2="61.5" strokeWidth="0.72"/>
        <line x1="148.0" y1="46.2" x2="148.0" y2="61.5" strokeWidth="0.72"/>
        <line x1="149.3" y1="46.4" x2="150.1" y2="61.5" strokeWidth="0.72"/>
        <line x1="151.6" y1="46.8" x2="152.6" y2="61.5" strokeWidth="0.72"/>
        <line x1="153.9" y1="47.4" x2="155.1" y2="61.5" strokeWidth="0.72"/>
        <line x1="156.2" y1="48.5" x2="157.5" y2="61.5" strokeWidth="0.72"/>

        {/* Main dome silhouette */}
        <path d="M136.5,62 C119,68 95,90 91,134" strokeWidth="1.65"/>
        <path d="M159.5,62 C177,68 201,90 205,134" strokeWidth="1.65"/>

        {/* Dome ribs */}
        <path d="M140,62   C126,69  104,91  100,134" strokeWidth="0.62"/>
        <path d="M143.5,62 C133,67  117,87  113,134" strokeWidth="0.62"/>
        <path d="M146.5,62 C141,66  134,83  132,134" strokeWidth="0.62"/>
        <path d="M149.5,62 C155,66  162,83  164,134" strokeWidth="0.62"/>
        <path d="M152.5,62 C163,67  179,87  183,134" strokeWidth="0.62"/>
        <path d="M156,62   C170,69  192,91  196,134" strokeWidth="0.62"/>
        <path d="M103,108 Q148,116 193,108" strokeWidth="0.78"/>

        {/* Entablature */}
        <line x1="91"  y1="134" x2="205" y2="134" strokeWidth="1.5"/>
        <line x1="89"  y1="139" x2="207" y2="139" strokeWidth="0.95"/>
        <line x1="87"  y1="144" x2="209" y2="144" strokeWidth="1.5"/>

        {/* Colonnade rails + walls */}
        <line x1="83"  y1="184" x2="213" y2="184" strokeWidth="1.5"/>
        <line x1="87"  y1="144" x2="83"  y2="184" strokeWidth="1.3"/>
        <line x1="209" y1="144" x2="213" y2="184" strokeWidth="1.3"/>

        {/* Colonnade columns */}
        <line x1="87"   y1="144" x2="83"   y2="184" strokeWidth="0.82"/>
        <line x1="93.1" y1="144" x2="89.4" y2="184" strokeWidth="0.82"/>
        <line x1="99.2" y1="144" x2="95.9" y2="184" strokeWidth="0.82"/>
        <line x1="105.3" y1="144" x2="102.3" y2="184" strokeWidth="0.82"/>
        <line x1="111.4" y1="144" x2="108.7" y2="184" strokeWidth="0.82"/>
        <line x1="117.5" y1="144" x2="115.1" y2="184" strokeWidth="0.82"/>
        <line x1="123.6" y1="144" x2="121.5" y2="184" strokeWidth="0.82"/>
        <line x1="129.7" y1="144" x2="127.9" y2="184" strokeWidth="0.82"/>
        <line x1="135.8" y1="144" x2="134.3" y2="184" strokeWidth="0.82"/>
        <line x1="141.9" y1="144" x2="140.7" y2="184" strokeWidth="0.82"/>
        <line x1="148"   y1="144" x2="148"   y2="184" strokeWidth="0.82"/>
        <line x1="154.1" y1="144" x2="155.3" y2="184" strokeWidth="0.82"/>
        <line x1="160.2" y1="144" x2="161.7" y2="184" strokeWidth="0.82"/>
        <line x1="166.3" y1="144" x2="168.1" y2="184" strokeWidth="0.82"/>
        <line x1="172.4" y1="144" x2="174.5" y2="184" strokeWidth="0.82"/>
        <line x1="178.5" y1="144" x2="180.9" y2="184" strokeWidth="0.82"/>
        <line x1="184.6" y1="144" x2="187.3" y2="184" strokeWidth="0.82"/>
        <line x1="190.7" y1="144" x2="193.7" y2="184" strokeWidth="0.82"/>
        <line x1="196.8" y1="144" x2="200.1" y2="184" strokeWidth="0.82"/>
        <line x1="202.9" y1="144" x2="206.5" y2="184" strokeWidth="0.82"/>
        <line x1="209"   y1="144" x2="213"   y2="184" strokeWidth="0.82"/>

        {/* Colonnade arches */}
        <path d="M87,161   Q90.05,153  93.1,160"   strokeWidth="0.68"/>
        <path d="M93.1,161 Q96.15,153  99.2,160"   strokeWidth="0.68"/>
        <path d="M99.2,161 Q102.25,153 105.3,160"  strokeWidth="0.68"/>
        <path d="M105.3,161 Q108.35,153 111.4,160" strokeWidth="0.68"/>
        <path d="M111.4,161 Q114.45,153 117.5,160" strokeWidth="0.68"/>
        <path d="M117.5,161 Q120.55,153 123.6,160" strokeWidth="0.68"/>
        <path d="M123.6,161 Q126.65,153 129.7,160" strokeWidth="0.68"/>
        <path d="M129.7,161 Q132.75,153 135.8,160" strokeWidth="0.68"/>
        <path d="M135.8,161 Q138.85,153 141.9,160" strokeWidth="0.68"/>
        <path d="M141.9,161 Q144.95,153 148,160"   strokeWidth="0.68"/>
        <path d="M148,161   Q151.05,153 154.1,160" strokeWidth="0.68"/>
        <path d="M154.1,161 Q157.15,153 160.2,160" strokeWidth="0.68"/>
        <path d="M160.2,161 Q163.25,153 166.3,160" strokeWidth="0.68"/>
        <path d="M166.3,161 Q169.35,153 172.4,160" strokeWidth="0.68"/>
        <path d="M172.4,161 Q175.45,153 178.5,160" strokeWidth="0.68"/>
        <path d="M178.5,161 Q181.55,153 184.6,160" strokeWidth="0.68"/>
        <path d="M184.6,161 Q187.65,153 190.7,160" strokeWidth="0.68"/>
        <path d="M190.7,161 Q193.75,153 196.8,160" strokeWidth="0.68"/>
        <path d="M196.8,161 Q199.85,153 202.9,160" strokeWidth="0.68"/>
        <path d="M202.9,161 Q205.95,153 209,160"   strokeWidth="0.68"/>

        {/* Lower drum */}
        <line x1="83"  y1="184" x2="213" y2="184" strokeWidth="1.5"/>
        <line x1="71"  y1="208" x2="225" y2="208" strokeWidth="1.5"/>
        <line x1="83"  y1="184" x2="71"  y2="208" strokeWidth="1.3"/>
        <line x1="213" y1="184" x2="225" y2="208" strokeWidth="1.3"/>
        <line x1="77"  y1="196" x2="219" y2="196" strokeWidth="0.9"/>
        <line x1="95.8" y1="184" x2="85.3" y2="208" strokeWidth="0.82"/>
        <line x1="108.6" y1="184" x2="99.6" y2="208" strokeWidth="0.82"/>
        <line x1="121.4" y1="184" x2="113.9" y2="208" strokeWidth="0.82"/>
        <line x1="134.2" y1="184" x2="128.2" y2="208" strokeWidth="0.82"/>
        <line x1="144"   y1="184" x2="140"  y2="208" strokeWidth="0.82"/>
        <line x1="148"   y1="184" x2="148"  y2="208" strokeWidth="0.82"/>
        <line x1="152"   y1="184" x2="156"  y2="208" strokeWidth="0.82"/>
        <line x1="161.8" y1="184" x2="167.8" y2="208" strokeWidth="0.82"/>
        <line x1="174.6" y1="184" x2="182.1" y2="208" strokeWidth="0.82"/>
        <line x1="187.4" y1="184" x2="196.4" y2="208" strokeWidth="0.82"/>
        <line x1="200.2" y1="184" x2="210.7" y2="208" strokeWidth="0.82"/>

        {/* Three-step base */}
        <line x1="71"  y1="208" x2="225" y2="208" strokeWidth="1.5"/>
        <line x1="59"  y1="216" x2="237" y2="216" strokeWidth="1.3"/>
        <line x1="71"  y1="208" x2="59"  y2="216" strokeWidth="1.2"/>
        <line x1="225" y1="208" x2="237" y2="216" strokeWidth="1.2"/>
        <line x1="45"  y1="224" x2="251" y2="224" strokeWidth="1.3"/>
        <line x1="59"  y1="216" x2="45"  y2="224" strokeWidth="1.2"/>
        <line x1="237" y1="216" x2="251" y2="224" strokeWidth="1.2"/>
        <line x1="30"  y1="232" x2="266" y2="232" strokeWidth="1.7"/>
        <line x1="45"  y1="224" x2="30"  y2="232" strokeWidth="1.2"/>
        <line x1="251" y1="224" x2="266" y2="232" strokeWidth="1.2"/>
      </g>

      {/* CIVICISM text */}
      <text
        x="300"
        y="196"
        fontFamily="Oxanium, sans-serif"
        fontWeight="300"
        fontSize="144"
        letterSpacing="3"
        fill="currentColor"
        dominantBaseline="auto"
      >CIVICISM</text>
    </svg>
  );
}
