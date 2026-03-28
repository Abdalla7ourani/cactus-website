class a extends HTMLElement{static get observedAttributes(){return["id","width","height","rounded","rounded-mobile","corner-rounded","corner-rounded-mobile","corner-size","corner-size-mobile","corner","stroke-width","class","filter","image","overlay"]}constructor(){super(),this.attachShadow({mode:"open"}),this._width=0,this._height=0,this.resizeTimer=null,this._lastWindowHeight=window.innerHeight,this.globalResizeHandler=this.handleGlobalResize.bind(this),this._measureElement=null,this._cachedValues=null,this.isMobile=window.innerWidth<1025,this.mediaQueryHandler=this.handleMediaQueryChange.bind(this),this.mediaQuery=window.matchMedia("(max-width: 1024px)"),this.resizeObserver=new ResizeObserver(s=>{if(this.isMobile){const e=window.innerHeight,i=Math.abs(e-this._lastWindowHeight);if(i>0&&i<150){this._lastWindowHeight=e;return}this._lastWindowHeight=e}for(const e of s){const i=e.contentRect.width,r=e.contentRect.height;(this._width!==i||this._height!==r)&&i>0&&r>0&&(this._width=i,this._height=r,this._cachedValues=null,this.updateSVG())}})}handleMediaQueryChange(s){this.isMobile=s.matches,this._cachedValues=null,this.updateSVG()}getMeasureElement(){let s=document.getElementById("svg-elements-helpers");return s||(s=document.createElement("div"),s.id="svg-elements-helpers",s.style.cssText="position:absolute;visibility:hidden;pointer-events:none;height:0;width:0;overflow:hidden;",document.body.appendChild(s)),this._measureElement||(this._measureElement=document.createElement("div"),this._measureElement.style.cssText="position:absolute;visibility:hidden;pointer-events:none;",s.appendChild(this._measureElement)),this._measureElement}computeAllCSSValues(){const s=this.getMeasureElement(),e={cornerRadius:20,cutCornerRadius:null,cutSize:null},i=this.getAttribute(this.isMobile&&this.hasAttribute("rounded-mobile")?"rounded-mobile":"rounded");if(i)if(this.isCSSValue(i)){s.style.width=i;const l=parseFloat(window.getComputedStyle(s).width);e.cornerRadius=isNaN(l)?20:l}else{const l=Number(i);e.cornerRadius=isNaN(l)?20:l}const r=this.getAttribute(this.isMobile&&this.hasAttribute("corner-rounded-mobile")?"corner-rounded-mobile":"corner-rounded");if(r)if(this.isCSSValue(r)){s.style.width=r;const l=parseFloat(window.getComputedStyle(s).width);e.cutCornerRadius=isNaN(l)?e.cornerRadius:l}else{const l=Number(r);e.cutCornerRadius=isNaN(l)?e.cornerRadius:l}else e.cutCornerRadius=e.cornerRadius;const n=this.getAttribute(this.isMobile&&this.hasAttribute("corner-size-mobile")?"corner-size-mobile":"corner-size"),h=Math.max(e.cornerRadius*2,Math.min(Math.min(this._width,this._height)/2,60));if(n)if(this.isCSSValue(n)){s.style.width=n;const l=parseFloat(window.getComputedStyle(s).width);isNaN(l)?e.cutSize=h:e.cutSize=Math.max(e.cornerRadius*2,Math.min(Math.min(this._width,this._height)*.9,l))}else{const l=Number(n);isNaN(l)?e.cutSize=h:e.cutSize=Math.max(e.cornerRadius*2,Math.min(Math.min(this._width,this._height)*.9,l))}else e.cutSize=h;return e}isCSSValue(s){return isNaN(Number(s))||s.includes("clamp(")||s.includes("calc(")||s.includes("min(")||s.includes("max(")||s.includes("rem")||s.includes("em")||s.includes("px")||s.includes("vw")||s.includes("vh")||s.includes("var(")}getCachedValues(){return this._cachedValues||(this._cachedValues=this.computeAllCSSValues()),this._cachedValues}handleGlobalResize(){this.resizeTimer&&clearTimeout(this.resizeTimer),!this.isMobile&&(this.resizeTimer=setTimeout(()=>{const s=this.offsetWidth,e=this.offsetHeight;s>0&&e>0&&(this._width=s,this._height=e,this._cachedValues=null,this.updateSVG())},100))}init(){const s=document.createElement("template");s.innerHTML=`
		<style>
		  :host {
			display: block;
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			pointer-events: none;
			z-index: -1;
			box-sizing: border-box;
			contain: content;
		  }
		  
		  .svg-container {
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			pointer-events: none;
		  }
		  
		  svg {
			width: 100%;
			height: 100%;
			display: block;
		  }
		</style>
		<svg preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" class="svg-container">
		${this.getAttribute("filter")?`
			<path></path>
			<foreignObject x="0" y="0" width="100%" height="100%">
					  <div xmlns="http://www.w3.org/1999/xhtml"
						style="backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);clip-path:url(#customPathClip);height:100%;width:100%">
					  </div>
					</foreignObject>
					<defs>
					  <clipPath id="customPathClip">
						<path></path>
					  </clipPath>
					</defs>
		  `:this.hasAttribute("image")?`
				<path></path>
				<pattern id="${this.getAttribute("id")}-pattern" patternUnits="userSpaceOnUse" width="100%" height="100%">
				 	 <image href="${this.getAttribute("image")}" x="-1%" y="-1%" width="102%" height="102%" preserveAspectRatio="${this.getAttribute("image-position")==="tl"?"xMidYMin slice":this.getAttribute("image-position")==="tr"?"xMaxYMin slice":this.getAttribute("image-position")==="bl"?"xMinYMax slice":this.getAttribute("image-position")==="br"?"xMaxYMax slice":"xMidYMid slice"}" />
					 ${this.getAttribute("overlay")&&`<rect x="0" y="0" width="100%" height="100%" fill="black" opacity="${this.getAttribute("overlay")}" />`}
				</pattern>
				`:"<path></path>"}
		</svg>
	  `,this.shadowRoot.appendChild(s.content.cloneNode(!0)),this.svgContainer=this.shadowRoot.querySelector(".svg-container"),this.svg=this.shadowRoot.querySelector("svg"),this.path=this.shadowRoot.querySelectorAll("path")[0],this.getAttribute("filter")&&(this.clipPath=this.shadowRoot.querySelectorAll("path")[1]),this.content=this.shadowRoot.querySelector(".content"),this.path.setAttribute("stroke-width",this.strokeWidth)}connectedCallback(){this.init(),this.mediaQuery.addEventListener("change",this.mediaQueryHandler),this.resizeObserver.observe(this),window.addEventListener("resize",this.globalResizeHandler),requestAnimationFrame(()=>{this.checkAndUpdateSize(),this.classList.add("ready")})}checkAndUpdateSize(){const s=this.offsetWidth,e=this.offsetHeight;s>0&&e>0&&(this._width=s,this._height=e,this.updateSVG())}disconnectedCallback(){this.resizeObserver.unobserve(this),window.removeEventListener("resize",this.globalResizeHandler),this.mediaQuery.removeEventListener("change",this.mediaQueryHandler),this.resizeTimer&&clearTimeout(this.resizeTimer),this._measureElement&&this._measureElement.parentNode&&(this._measureElement.parentNode.removeChild(this._measureElement),this._measureElement=null)}attributeChangedCallback(s,e,i){e!==i&&(s==="width"?(this._width=Number(i)||0,this._cachedValues=null,this.updateSVG()):s==="height"?(this._height=Number(i)||0,this._cachedValues=null,this.updateSVG()):s==="rounded"||s==="rounded-mobile"||s==="corner-rounded"||s==="corner-rounded-mobile"||s==="corner-size"||s==="corner-size-mobile"?(this._cachedValues=null,this.updateSVG()):s!=="class"&&this.updateSVG())}updateSVG(){if(!this.svg||!this.path||this._width===0||this._height===0)return;const s=isNaN(this.strokeWidth)?0:this.strokeWidth;this.svg.setAttribute("viewBox",`0 0 ${Math.ceil(this._width)-s} ${Math.ceil(this._height)-s}`);const e=this.generatePath();if(e&&!e.includes("NaN")?(this.path.setAttribute("d",e),this.getAttribute("filter")&&this.clipPath.setAttribute("d",e),this.hasAttribute("image")&&this.path.setAttribute("fill",`url(#${this.getAttribute("id")}-pattern)`)):console.error("Invalid path data generated:",e),this.getAttribute("id")&&this.getAttribute("id")!=="keep"||this.parentElement){const i=document.getElementById(this.getAttribute("id"))||this.parentElement;i&&i.classList.remove("bg-white")}this.path.setAttribute("stroke-width",s)}get width(){return Number(this.getAttribute("width")||0)}get height(){return Number(this.getAttribute("height")||0)}get cornerRadius(){return this.getCachedValues().cornerRadius}get cutCornerRadius(){return this.getCachedValues().cutCornerRadius}get cutSize(){return this.getCachedValues().cutSize}get cutPosition(){return this.getAttribute("corner")||"br"}get strokeWidth(){return Number(this.getAttribute("stroke-width")||1)}generatePath(){const s=isNaN(this.strokeWidth)?0:this.strokeWidth,e=Math.ceil(this._width-s),i=Math.ceil(this._height-s),r=this.getCachedValues();let n=Math.ceil(r.cornerRadius);isNaN(n)&&(n=0);let h=Math.ceil(r.cutCornerRadius);isNaN(h)&&(h=0);let l=Math.ceil(r.cutSize);isNaN(l)&&(l=60);const t=this.cutPosition,o=this.getAttribute("id");return this.generateRoundedPath(o,e,i,n,h,l,t)}generateRoundedPath(s,e,i,r,n,h,l){let t="";const o=isNaN(this.strokeWidth)?0:this.strokeWidth;return s&&s==="button"?(t=`M ${r} 1`,t+=` L ${e-r} 1`,t+=` Q ${e} 0 ${e-o} ${r}`,t+=` L ${e-o} ${i-h-n}`,t+=` Q ${e-o} ${i-h} ${e-n} ${i-h+n}`,t+=` L ${e-h+n} ${i-n-o}`,t+=` Q ${e-h} ${i-o} ${e-h-n} ${i-o}`,t+=` L ${r} ${i-o}`,t+=` Q 0 ${i} 1 ${i-r}`,t+=` L 1 ${r}`,t+=` Q 0 0 ${r} 1`,t+=" Z",t):s&&s==="solutions"?(t=`M ${r} 1`,t+=` L ${e-h-n} 1`,t+=` Q ${e-h} ${o} ${e-h+n} ${n+o}`,t+=` L ${e-n} ${h-n-o}`,t+=` Q ${e-o} ${h} ${e-o} ${h+n}`,t+=` L ${e-o} ${i-r}`,t+=` Q ${e} ${i} ${e-r} ${i-o}`,t+=` L ${r} ${i-o}`,t+=` Q 0 ${i} 1 ${i-r}`,t+=` L 1 ${r}`,t+=` Q 0 0 ${r} 1`,t+=" Z",t):(l==="br"?(t=`M ${r} 0`,t+=` L ${e-r} 0`,t+=` Q ${e} 0 ${e} ${r}`,t+=` L ${e} ${i-h-n}`,t+=` Q ${e} ${i-h} ${e-n} ${i-h+n}`,t+=` L ${e-h+n} ${i-n}`,t+=` Q ${e-h} ${i} ${e-h-n} ${i}`,t+=` L ${r} ${i}`,t+=` Q 0 ${i} 0 ${i-r}`,t+=` L 0 ${r}`,t+=` Q 0 0 ${r} 0`):l==="tr"?(t=`M ${r} 0`,t+=` L ${e-h-n} 0`,t+=` Q ${e-h} 0 ${e-h+n} ${n}`,t+=` L ${e-n} ${h-n}`,t+=` Q ${e} ${h} ${e} ${h+n}`,t+=` L ${e} ${i-r}`,t+=` Q ${e} ${i} ${e-r} ${i}`,t+=` L ${r} ${i}`,t+=` Q 0 ${i} 0 ${i-r}`,t+=` L 0 ${r}`,t+=` Q 0 0 ${r} 0`):l==="bl"?(t=`M ${r} 0`,t+=` L ${e-r} 0`,t+=` Q ${e} 0 ${e} ${r}`,t+=` L ${e} ${i-r}`,t+=` Q ${e} ${i} ${e-r} ${i}`,t+=` L ${h+n} ${i}`,t+=` Q ${h} ${i} ${h-n} ${i-n}`,t+=` L ${n} ${i-h+n}`,t+=` Q 0 ${i-h} 0 ${i-h-n}`,t+=` L 0 ${r}`,t+=` Q 0 0 ${r} 0`):(t=`M ${h+n} 0`,t+=` L ${e-r} 0`,t+=` Q ${e} 0 ${e} ${r}`,t+=` L ${e} ${i-r}`,t+=` Q ${e} ${i} ${e-r} ${i}`,t+=` L ${r} ${i}`,t+=` Q 0 ${i} 0 ${i-r}`,t+=` L 0 ${h+n}`,t+=` Q 0 ${h} ${n} ${h-n}`,t+=` L ${h-n} ${n}`,t+=` Q ${h} 0 ${h+n} 0`),t+=" Z",t)}}customElements.define("wm-shape",a);
