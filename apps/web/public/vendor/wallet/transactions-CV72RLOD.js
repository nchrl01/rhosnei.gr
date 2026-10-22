import"./chunk-XBHUL4BO.js";import"./chunk-E42UWIX6.js";import"./chunk-77MVIB4F.js";import"./chunk-RI24VZ65.js";import"./chunk-AQTBP3CC.js";import"./chunk-UC3M2R4E.js";import"./chunk-M4MK2YZY.js";import{b as c,e as m,k as a,u as p}from"./chunk-DPL33VW2.js";import"./chunk-RCUWDPLL.js";import"./chunk-IV5FR2YO.js";import"./chunk-B3VIS66E.js";import"./chunk-ABLSBJRG.js";import"./chunk-JG6YPVA3.js";import"./chunk-M5Z5WUB7.js";import"./chunk-JTYV7RXW.js";import"./chunk-KL2DZ7E2.js";var w=c`
  :host > wui-flex:first-child {
    height: 500px;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none;
  }

  :host > wui-flex:first-child::-webkit-scrollbar {
    display: none;
  }
`;var u=function(o,e,i,r){var l=arguments.length,t=l<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,n;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")t=Reflect.decorate(o,e,i,r);else for(var f=o.length-1;f>=0;f--)(n=o[f])&&(t=(l<3?n(t):l>3?n(e,i,t):n(e,i))||t);return l>3&&t&&Object.defineProperty(e,i,t),t},s=class extends a{render(){return m`
      <wui-flex flexDirection="column" .padding=${["0","3","3","3"]} gap="3">
        <w3m-activity-list page="activity"></w3m-activity-list>
      </wui-flex>
    `}};s.styles=w;s=u([p("w3m-transactions-view")],s);export{s as W3mTransactionsView};
