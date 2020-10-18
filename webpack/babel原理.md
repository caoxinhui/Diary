抽象语法树（AST）
解析器会根据ECMAScript 标准「JavaScript语言规范」来对代码字符串进行词法分析，拆分成一个个词法单元，再遍历各个词法单元进行语法分析构造出AST。
词法分析（Lexical Analysis）
对代码解析时先进入词法分析阶段，tokenizer(分词器)会将原始代码按照特定字符(如let、var、=等保留字)分成一个个叫token的东西。token由分号、标签、变量、字符串等组成，tokenizer将tokens构造成如下数据结构。
语法分析（Syntactic Analysis）
词法分析完毕后进入语法分析阶段，语法分析将tokens重新格式化为描述语法各部分及其相互关系的表示形式，这就是抽象语法树。这个抽象语法树就是写Babel插件的核心概念，因为代码转换就是针对各个节点进行操作。
                                                             
Babel编译过程
- 用解析器将代码转换成AST(抽象语法树) @babel/parser
- 遍历AST后使用插件进行修改 @babel/traverse
- 将AST转化成代码 @babel/generator
