// Graphiques SVG maison : cumul des points tour par tour (moi / adversaire)
// et points marqués à chaque tour. Les séries se distinguent par la couleur,
// le tracé (plein / tirets) et la légende.

const W = 328;
const L = 30;
const R = 12;
const IW = W - L - R;

function niceMax(v, step, min) {
  return Math.max(min, Math.ceil(v / step) * step);
}

export default function ProgressChart({ me, opp }) {
  // --- Cumul
  const H1 = 176;
  const T1 = 14;
  const B1 = 26;
  const cum = (p) => [0, ...p.points_by_turn.map((t) => t.cumul)];
  const cm = cum(me);
  const co = cum(opp);
  const max1 = niceMax(Math.max(...cm, ...co), 10, 20);
  const x1 = (i) => L + (IW * i) / 5;
  const y1 = (v) => T1 + (H1 - T1 - B1) * (1 - v / max1);
  const path = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${x1(i).toFixed(1)} ${y1(v).toFixed(1)}`).join(' ');
  const meEnd = cm[5];
  const oppEnd = co[5];

  // --- Points par tour
  const H2 = 150;
  const T2 = 16;
  const B2 = 24;
  const tm = me.points_by_turn.map((t) => t.total);
  const to = opp.points_by_turn.map((t) => t.total);
  const max2 = niceMax(Math.max(...tm, ...to), 5, 10);
  const y2 = (v) => T2 + (H2 - T2 - B2) * (1 - v / max2);
  const bw = IW / 5;
  const barW = bw * 0.34;

  return (
    <div>
      <div className="legend">
        <span>
          <i className="me" />
          {me.name}
        </span>
        <span>
          <i className="opp" />
          {opp.name}
        </span>
      </div>

      <h3>Cumul des points (avec plafonds)</h3>
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H1}`}
        role="img"
        aria-label={`Cumul des points après chaque tour : ${me.name} ${meEnd}, ${opp.name} ${oppEnd}.`}
      >
        {[0, max1 / 2, max1].map((v) => (
          <g key={v}>
            <line className="axis" x1={L} x2={W - R} y1={y1(v)} y2={y1(v)} />
            <text x={L - 5} y={y1(v) + 3} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <text key={i} x={x1(i)} y={H1 - 8} textAnchor="middle">
            {i === 0 ? 'Début' : `T${i}`}
          </text>
        ))}
        <path className="line-opp" d={path(co)} />
        <path className="line-me" d={path(cm)} />
        {cm.map((v, i) => (
          <circle key={`m${i}`} className="dot-me" cx={x1(i)} cy={y1(v)} r="3" />
        ))}
        {co.map((v, i) => (
          <circle key={`o${i}`} className="dot-opp" cx={x1(i)} cy={y1(v)} r="3" />
        ))}
        <text className="val-me" x={x1(5) - 6} y={y1(meEnd) + (meEnd >= oppEnd ? -8 : 15)} textAnchor="end">
          {meEnd}
        </text>
        <text className="val-opp" x={x1(5) - 6} y={y1(oppEnd) + (meEnd >= oppEnd ? 15 : -8)} textAnchor="end">
          {oppEnd}
        </text>
      </svg>

      <h3>Points marqués à chaque tour</h3>
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H2}`}
        role="img"
        aria-label={`Points marqués par tour : ${me.name} ${tm.join(', ')} ; ${opp.name} ${to.join(', ')}.`}
      >
        {[0, max2 / 2, max2].map((v) => (
          <g key={v}>
            <line className="axis" x1={L} x2={W - R} y1={y2(v)} y2={y2(v)} />
            <text x={L - 5} y={y2(v) + 3} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {tm.map((v, i) => {
          const cx = L + bw * i + bw / 2;
          return (
            <g key={i}>
              <rect className="bar-me" x={cx - barW - 1} y={y2(v)} width={barW} height={Math.max(0, y2(0) - y2(v))} rx="2" />
              <rect className="bar-opp" x={cx + 1} y={y2(to[i])} width={barW} height={Math.max(0, y2(0) - y2(to[i]))} rx="2" />
              {v > 0 && (
                <text className="val-me" x={cx - barW / 2 - 1} y={y2(v) - 3} textAnchor="middle">
                  {v}
                </text>
              )}
              {to[i] > 0 && (
                <text className="val-opp" x={cx + barW / 2 + 1} y={y2(to[i]) - 3} textAnchor="middle">
                  {to[i]}
                </text>
              )}
              <text x={cx} y={H2 - 8} textAnchor="middle">
                T{i + 1}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
