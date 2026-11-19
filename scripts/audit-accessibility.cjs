const ts = require("../app/node_modules/typescript");
const fs = require("node:fs"), path = require("node:path");
function visitFile(file) {
 const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
 function visit(node) {
  if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
   const name = node.tagName.getText(source);
   const attrs = Object.fromEntries(node.attributes.properties.filter(ts.isJsxAttribute).map(x => [x.name.getText(source), x.initializer?.getText(source) || "true"]));
   const line = source.getLineAndCharacterOfPosition(node.pos).line + 1;
   if (["img","Image"].includes(name) && !("alt" in attrs)) console.log("ALT",file,line,name,attrs.src);
   if (attrs.onClick && ["Box","Flex","Text","Card","Tr","HStack","VStack","Stack"].includes(name) &&
    !attrs.as && !attrs.role && !attrs.tabIndex) console.log("KEYBOARD",file,line,name);
  }
  ts.forEachChild(node,visit);
 }
 visit(source);
}
function walk(dir) { for(const item of fs.readdirSync(dir,{withFileTypes:true})) {
 const file=path.join(dir,item.name); if(item.isDirectory()) walk(file); else if(file.endsWith(".tsx")) visitFile(file);
} }
walk(path.resolve(__dirname,"../app/src"));
