import"./chunk-6U7V4H6J.js";import"./chunk-25F5OPG3.js";import"./chunk-LFCDXWVU.js";import"./chunk-RI24VZ65.js";import"./chunk-JG5ZMJVF.js";import"./chunk-HCN4HEDB.js";import"./chunk-CONKREFE.js";import{b as c,e as m,k as a,u as p}from"./chunk-27TIPUWF.js";import"./chunk-ZIEEYSCG.js";import"./chunk-IV5FR2YO.js";import"./chunk-EPEDRRHD.js";import"./chunk-ABLSBJRG.js";import"./chunk-JG6YPVA3.js";import"./chunk-M5Z5WUB7.js";import"./chunk-JTYV7RXW.js";import"./chunk-KL2DZ7E2.js";var w=c`
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
