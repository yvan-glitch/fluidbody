const fs=require('fs'),path=require('path');
const parser=require('@babel/parser');
const traverse=require('@babel/traverse').default;
function walk(d,out){for(const f of fs.readdirSync(d)){const p=path.join(d,f);const s=fs.statSync(p);if(s.isDirectory()){if(f==='node_modules')continue;walk(p,out)}else if(/\.(js|jsx|ts|tsx)$/.test(f))out.push(p)}return out}
const files=['App.js',...walk('src',[])];
let total=0;
for(const f of files){
  const src=fs.readFileSync(f,'utf8');
  if(!/[—–]/.test(src))continue;
  let ast;try{ast=parser.parse(src,{sourceType:'module',plugins:['jsx','typescript'],errorRecovery:true})}catch(e){console.log('PARSE FAIL',f,e.message);continue}
  const hits=[];
  traverse(ast,{
    StringLiteral(p){if(/[—–]/.test(p.node.value))hits.push([p.node.loc.start.line,p.node.value])},
    TemplateElement(p){if(/[—–]/.test(p.node.value.raw))hits.push([p.node.loc.start.line,p.node.value.raw])},
    JSXText(p){if(/[—–]/.test(p.node.value))hits.push([p.node.loc.start.line,p.node.value.trim()])},
  });
  if(hits.length){console.log('## '+f+' ('+hits.length+')');for(const h of hits)console.log('  L'+h[0]+': '+h[1].replace(/\n/g,'\\n').slice(0,160));total+=hits.length}
}
console.log('TOTAL',total);
