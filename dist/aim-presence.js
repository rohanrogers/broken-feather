// A brief held cursor is presentation only. current=false immediately prevents
// a visible hold from authorizing another shot while tracking is absent.
export class AimPresence {
  constructor(){this.reset();}
  reset(){this.lastUsableAt=-Infinity;this.current=false;}
  observe(usable,now){this.current=!!usable;if(usable)this.lastUsableAt=now;}
  visible(now,freshnessMs=180){return now-this.lastUsableAt<Math.max(250,freshnessMs);}
  live(now,freshnessMs=180){return this.current&&now-this.lastUsableAt<freshnessMs;}
}
