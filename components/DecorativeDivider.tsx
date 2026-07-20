"use client";

export function DecorativeDivider({ color, index }: { color: string; index: number }) {
  const c = color;
  const dividers = [
    <svg key={0} viewBox="0 0 400 36" xmlns="http://www.w3.org/2000/svg" width="100%" height="36">
      <path d="M 15 18 C 45 4 85 4 115 18 C 145 32 175 32 193 18" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      <path d="M 200 9 L 209 18 L 200 27 L 191 18 Z" fill={c}/>
      <path d="M 207 18 C 225 4 255 4 285 18 C 315 32 355 32 385 18" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    </svg>,
    <svg key={1} viewBox="0 0 400 36" xmlns="http://www.w3.org/2000/svg" width="100%" height="36">
      <path d="M 10 18 Q 70 8 130 18 Q 200 28 270 18 Q 330 8 390 18" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      {([[50,10],[130,26],[200,10],[270,26],[340,10]] as [number,number][]).map(([x,y],i) =>
        <circle key={i} cx={x} cy={y} r="2.8" fill={c}/>
      )}
    </svg>,
    <svg key={2} viewBox="0 0 400 36" xmlns="http://www.w3.org/2000/svg" width="100%" height="36">
      <line x1="28" y1="18" x2="372" y2="18" stroke={c} strokeWidth="1.4"/>
      <path d="M 8 18 L 18 12 L 28 18 L 18 24 Z" fill={c}/>
      <path d="M 372 18 L 382 12 L 392 18 L 382 24 Z" fill={c}/>
      <path d="M 193 11 L 200 18 L 207 11 L 200 4 Z" fill={c}/>
      <path d="M 193 25 L 200 18 L 207 25 L 200 32 Z" fill={c}/>
      {[100,150,250,300].map((x,i) => <circle key={i} cx={x} cy={18} r="2" fill={c}/>)}
    </svg>,
    <svg key={3} viewBox="0 0 400 36" xmlns="http://www.w3.org/2000/svg" width="100%" height="36">
      <line x1="10" y1="18" x2="390" y2="18" stroke={c} strokeWidth="1.2" opacity={0.4}/>
      {([10,50,90,130,165,195,200,205,235,270,310,350,390] as number[]).map((x,i) => {
        const dist = Math.abs(x - 200);
        const r = Math.max(1.2, 4.5 - dist * 0.018);
        return <circle key={i} cx={x} cy={18} r={r} fill={c}/>;
      })}
    </svg>,
    <svg key={4} viewBox="0 0 400 44" xmlns="http://www.w3.org/2000/svg" width="100%" height="44">
      <path d="M 20 22 C 60 8 100 36 140 22" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M 260 22 C 300 8 340 36 380 22" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M 140 22 C 160 14 168 8 175 4 C 180 8 185 14 195 22" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M 205 22 C 215 14 220 8 225 4 C 232 8 240 14 260 22" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx={200} cy={22} r={4} fill={c}/>
      <path d="M 196 22 C 190 28 185 36 182 40" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M 204 22 C 210 28 215 36 218 40" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>,
    <svg key={5} viewBox="0 0 400 36" xmlns="http://www.w3.org/2000/svg" width="100%" height="36">
      <path d="M 10 18 C 40 6 60 30 100 18 C 140 6 160 30 200 18 C 240 6 260 30 300 18 C 340 6 360 30 390 18" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      {[60,160,240,340].map((x,i) => {
        const y = i % 2 === 0 ? 30 : 6;
        return <path key={i} d={`M ${x} ${y} C ${x-6} ${y+(i%2===0?6:-6)} ${x+6} ${y+(i%2===0?6:-6)} ${x} ${y}`} fill="none" stroke={c} strokeWidth="1.5"/>;
      })}
    </svg>,
    <svg key={6} viewBox="0 0 400 36" xmlns="http://www.w3.org/2000/svg" width="100%" height="36">
      <path d="M 30 18 L 370 18" stroke={c} strokeWidth="1.2"/>
      <path d="M 30 18 C 20 18 12 12 16 6 C 20 0 28 6 28 14" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M 370 18 C 380 18 388 12 384 6 C 380 0 372 6 372 14" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      {[155,170,185,200,215,230,245].map((x,i) => {
        const r = i === 3 ? 5 : i === 2 || i === 4 ? 3.5 : i === 1 || i === 5 ? 2.5 : 1.8;
        return <circle key={i} cx={x} cy={18} r={r} fill={c}/>;
      })}
    </svg>,
    <svg key={7} viewBox="0 0 400 36" xmlns="http://www.w3.org/2000/svg" width="100%" height="36">
      <line x1="38" y1="18" x2="362" y2="18" stroke={c} strokeWidth="1.4"/>
      <path d="M 10 18 L 26 10 L 22 18 L 26 26 Z" fill={c}/>
      <line x1="10" y1="18" x2="38" y2="18" stroke={c} strokeWidth="1.4"/>
      <path d="M 390 18 L 374 10 L 378 18 L 374 26 Z" fill={c}/>
      <line x1="362" y1="18" x2="390" y2="18" stroke={c} strokeWidth="1.4"/>
      {[175,188,200,212,225].map((x,i) => <circle key={i} cx={x} cy={18} r={i===2?4:2.5} fill={c}/>)}
    </svg>,
  ];
  return (
    <div style={{ maxWidth: 680, marginBottom: 32, marginTop: 12, opacity: 0.7 }}>
      {dividers[index % dividers.length]}
    </div>
  );
}
