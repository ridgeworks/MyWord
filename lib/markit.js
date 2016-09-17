// -- markit: framework module for publishing markup to HTML, contains MyWord ----

/*	The MIT License (MIT)
 *
 *	Copyright (c) 2016 Peter Cashin, Rick Workman
 *
 *	Permission is hereby granted, free of charge, to any person obtaining a copy
 *	of this software and associated documentation files (the "Software"), to deal
 *	in the Software without restriction, including without limitation the rights
 *	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *	copies of the Software, and to permit persons to whom the Software is
 *	furnished to do so, subject to the following conditions:
 *
 *	The above copyright notice and this permission notice shall be included in all
 *	copies or substantial portions of the Software.
 *
 *	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 *	SOFTWARE.
 */

;(function () {

	/*
	 *  0. Some helper functions for I/O
	 */

	var loadpath = [''];                 // base for relative URLs, acts like a stack

	function directory(url) {
		return url.substring(0, url.lastIndexOf('/') + 1)
	} // directory(url)

	function composeURL(path) {
		var url = path.trim();
		return ((url.charAt(0) === '/') || (url.indexOf('://') > 0)) ?
			url :				// partial or absolute URL
			loadpath[0] + url;	// relative URL
	} // composeURL(path)

	function fileContent(url) { // returns content or throws exception
		var status = 0;
		if (typeof XMLHttpRequest != 'undefined') {
			var request = new XMLHttpRequest();
			request.open("GET", url, false);   //synchronous IO, requires Worker mode in browsers
			request.onerror = function () {
				status = 404
			};
			request.send();   //; console.log(request.status,url,"["+request.responseText.length+"]")
			status = ((status == 0) ? request.status : status );   //; console.log("status=",status)
			if ((status === 200 || status === 0)) {
				//console.log(url+"["+request.responseText.length+"]="+request.responseText.slice(0,48))
				return request.responseText
			} else {
				throw new Error(["Reading '", url, "':\n\t status=", status].join(''));
				//ES6: throw new Error(`Reading '${url}' status=${status}`)
			}
		} else {	// try Nodejs file system
			return fs.readFileSync(url, "utf8");
		}
	} // fileContent(url)

	function loadScript(url) {
		if (typeof importScripts != 'undefined') {
			importScripts(url)
		} else {
			// need to ensure global translators are accessible via global space
			// using require() problematic: no global name, relative url needs ./
			// fails in some cases?:	 new Function(fileContent(url))()
			var geval = eval; geval(fileContent(url));	// eval() in global scope, independent of module scheme
		}
		return null		// return a defined value
	} // loadScript(url)

	function reportError(errorInfo){		// errorInfo = [String..]
		if (console) console.error(errorInfo.join(''))
	}


	/*
	 *  1. Init environment - load Grit and if executing as a Worker, setup message handler
	 */

	var workerMode = false; 		// Note, due to syncIO, file ops only work in Worker mode
	var workerID = '';
	var Grit;
	// Set workerMode; true if functioning as a Worker
	try {
		workerMode = (self instanceof WorkerGlobalScope)
	} catch (err) {}

	if (workerMode) {// When used in Worker mode
		// Load Grit - 	grit.js assumed to be co-located
		try {
			importScripts(directory(location.href) + "grit.js")
		} catch (err) {
			throw new Error(["loading grit.js: ", err.message].join(''))
		}
		Grit = self.Grit;
		onmessage = function (msg) {
			var html;                 //; console.log("Worker:" + workerID + " received request for " + msg.data[0])
			try {
				loadpath = [directory(msg.data[0])];   		// msg.data is [doc.href, transform, content, contextID]
				// console.log('contextID=',msg.data[3])
				context = contextList[msg.data[3]]
				html = markit(msg.data[1], msg.data[2]);   	// see markit() for spec
			} catch (err) {
				html = markit('errorString', err.message)
			}
			postMessage(html)
		};
		workerID = Date.now()
	} else {	// Node.js & CommonJS module system
		try {
			var fs = require('fs');
			// Load Grit - 	grit.js assumed to be co-located
			Grit = require("./grit.js");
			// define self for transform lookup
			if (typeof self == 'undefined')
				global.self = global
		} catch (err) {
			throw new Error(["Unsupported platform - upgrade browser or use CommonJS module system: ", err.message].join(''))
		}
	}
	if (console) console.log("Worker:" + workerID);


	/*
	 *  2. Context class for managing defs
	 */

	var Ctx = function (parent, blks) {
		this.parent = parent;	// link to parent context, null if root
		this.blks = blks;    	// from parse tree, no access methods
		this.index = {};   		// label to dataType map
		this.types = {};    		// dataType to transform map
	}; // new Ctx(parent)

	Ctx.prototype = {};

	// create a new (nested) context for blks
	Ctx.prototype.push = function (blks) {
		return new Ctx(this, blks)
	}; // Ctx.push(blks)

	// return parent context
	Ctx.prototype.pop = function () {
		return this.parent
	}; // Ctx.pop()

	// add new label definition : (will overwrite if duplicate)
	Ctx.prototype.addLabelDef = function (label, labelDef) {
		this.index[label] = labelDef
	}; // Ctx.addLabelDef(label, dataType)

	// lookup label definition associated with a label
	Ctx.prototype.labelDef = function (label) {
		var ldef = this.index[label];
		if (ldef) return ldef;
		if (this.parent) return this.parent.labelDef(label);
		return null
	}; // Ctx.labelDef(label)

	// add new transform name and associate it with a transform (will overwrite if duplicate)
	Ctx.prototype.addTransform = function (name, transform) {
		this.types[name] = transform
	}; // Ctx.addTransform(name, transform)

	// lookup a transform associated with name
	Ctx.prototype.transform = function (name) {                  // lookup data-type translator fn
		if (name) {
			var transform = this.types[name];                        // first search context chain
			if (transform) return transform;                         // found in this context
			if (this.parent) return this.parent.transform(name);    // found in parrent context
			try {                                                   // global translators are transforms
				var t = self[name]		//; console.log(workerID + ":globalTranslator(", name, ")=", t)
				if (typeof t == 'function') return t
			} catch (err) {
			}	                                    // ignore errors
		}
		return null;			                                    // any errors result in null
	}; // Ctx.transform(name)

	// check if there are any  defintitions...
	Ctx.prototype.hasDefinitions = function () {
		return (Object.keys(this.index).length > 0 || Object.keys(this.types).length > 0)
	}

	// Create empty root context and add framework dataTypes
	var context = new Ctx(null, []);

	var contextList = [context]				// persistant, immutable contexts for dynamic updates

	context.addTransform('text', function (content) {					// dataType for escaping text in HTML text nodes
		return content.replace(/</g,'&lt;')
	});

	context.addTransform('errorString', function (content) {			// dataType for error messages put in HTML output
		reportError(["markit(", workerID, "):", content]);
		return ["<pre><mark style='color:blue'>\n*** Error *** ", markit('text', content), "\n</mark></pre>"].join('');
		//ES6:  `<pre><mark style='color:blue'>\n*** Error *** ${markit('text', content)}\n</mark></pre>`
	});


	/*
	 *  3. Global function : markit(transform, content)
	 *  returns html string or null(no transform function found)
	 *  throws Error if transform does or if transform doesn't return a string
	 */

	function markit(transform, content) {
		var html = null;
		if (transform) {
			var translator = context.transform(transform);     //; console.log(transform,"=",translator)
			if (translator)
				html = translator.call(null, content);	  	// Note: exceptions not caught inside markit()
		}
		if ((html) && (typeof html !== 'string')) { // Expecting an HTML fragment
			throw new Error(
				["Bad result from transform for type '", transform, "' => ", JSON.stringify(html)].join());
			//`Bad result from transform for type '${transform}' => ${JSON.stringify(html)}`);
		}
		return html
	} // markit(transform, content)


	/*
	 *  4. compileGrammar(grammar)
	 *  compile a grammar and throw an Error if errors reprorted
	 */

	var compileGrammar = function (grammar) {
		var errors = grammar._compile();
		if (errors.length > 0) {
			errors.unshift(grammar._rules[0].name + " compile failed:");	//; console.log('grammar=',grammar,'\nerrors=',errors)
			throw new Error(errors.join('\n\t'))
		}
	};	// compileGrammar(grammar)


	/*
	 *  5. Transform: metawordParse(content)
	 *  label and type defintions
	 */

	var metaword = new Grit(
		"metaword   := (blank / labeldef / typedef / uses / js / css / comment / undefined)* ",
		"labeldef	:~ (%word)\\s+=%labelspec 		:: label(_,1:label,2:tag,3:word,4:tag,5:block) ",
		"typedef    :~ (%word)\\s+:%block 			:: type(rules) ",
		"uses		:~ @import\\s+(%block)    		:: uses(_,urls) ",
		"js			:~ @javascript\\s+(%block)    	:: js(_,js) ",				// Experimental @js feature
		"css		:~ @css\\s+(%block)    			:: css(_,css) ",			// Experimental @css feature
		"blank		:~ [ \\t]* %nl					:: (_) => {return []} ",
		"comment	:~ // %line %nl?            	:: (function (_) {return []}) ",
		"undefined	:~ ([ \\t]* [^\\n\\r]+)     	:: undefined(_,statement) ",
		"labelspec	:~ \\s*(?:(%tag) | (?:(%word) (?:%inset (%tag) | (%block))? ) )\\s*",
		"tag		:~ [<][^>]*[>]",
		"block		:~ %line %insetline* ",
		"insetline	:~ (?: [ \\t]* %nl | (%inset %line)) ",
		"word		:~ \\S+ ",
		"line		:~ [^\\n\\r]* ",
		"inset		:~ [ \\t]+ ",
		"nl			:~ (?:\\r \\n? | \\n)"
	);

	metaword.label = function (definition, label, nakedTag, transformName, tagWithTransform, attrsWithTransform) {
		// label(_,1:label,2:tag,3:word,4:tag,5:block)
		// construct label definition: {transform:transformName, tag:tagString}
		// Note: transformName may be null
		//		 tagString may be empty (null?) and may either be full tag (<..>) or additional attributes
		var tagInfo = (nakedTag) ? nakedTag : (tagWithTransform || attrsWithTransform);
		tagInfo = ((tagInfo) ? tagInfo.trim().replace(/\s+/g, " ") : "");
		var typeInfo = (nakedTag) ? null : transformName;
		// console.log(label,'=    transform:',typeInfo,"   tag:",tagInfo)
		context.addLabelDef(label, {transform: typeInfo, tag: tagInfo});
		return []
	}; // metaword.label(definition, label, nakedTag, transformName, tagWithTransform, attrsWithTransform)

	metaword.type = function (rules) {
		var html = [];
		try {
			var gram = new Grit(rules);		//; console.log(gram)
			compileGrammar(gram);
			context.addTransform(gram._rules[0].name, function(content) {
				var result =  gram.parse(content);
				var leftOver = content.substr(gram._lastMatch.length);
				if (leftOver.match(/^\s*$/))
					return result;
				else {	// if non-white space left over, append wrapped in a <pre> element
					reportError(["Transform: ",gram._rules[0].name,", content remaining:\n",leftOver]);
					return [result,"<pre>",leftOver,"</pre>"].join('')
				}
			})
		} catch (err) {		// compile errors on new types
			html = markit('errorString', err.message)
		}
		return html
	}; // metaword.type(rules)

	metaword.uses = function (_, urls) {
		var out = [];
		var urlist = urls.trim().split(/\s+/);
		for (var u=0; u < urlist.length; u++) {
			out.push(dispatchImportHandler(urlist[u]))
		} // for
		return out
	}; // metaword.uses(_, urls)

	metaword.js = function (_, js) {
		return ['<script type=application/javascript>', js, '</script>']
	}; // metaword.js = function (_, js)

	metaword.css = function (_, css) {
		return ['<style scoped>', css, '</style>']
	}; // metaword.css = function (_, css)

	metaword.undefined = function (_, statement) {
		//console.log('undef=',statement, statement.length, statement.charCodeAt(0));
		return markit('errorString', ["Unrecognized metaword statement:\n\t", statement].join(''));
		//ES6:                               `Unrecognized metaword statement: ${statement}`)
	}; // metaword.undefined(_, statement)

	compileGrammar(metaword);

	var importHandlers = {}

	// 'public' function to bind an import handler to a filetype (i.e., suffix, including '.', e.g., .css, .js
	function addImportHandler(fileType, handler) {
		importHandlers[fileType] = handler
	} // addImportHandler(fileType, handler)

	// 'public' function to select import handler based on URL suffix, and call it
	//   also handles relative URL semantics using composeURL and loadpath
	//   returns HTML string (possibly an error report) for inclusion in document
	function dispatchImportHandler(url) {
		var returnValue
		var absurl = composeURL(url)
		var fileSuffix = absurl.substring(absurl.lastIndexOf('.'))
		var importHandler = importHandlers[fileSuffix]
		if (importHandler) {
			loadpath.unshift(directory(absurl))	// push new loadpath
			returnValue = importHandler.call(null, absurl)
			loadpath.shift()					// pop loadpath
		} else {
			returnValue = markit('errorString', ["Importing '", absurl, "', unsupported file type: ", fileSuffix].join(''))
		}
		return returnValue
	} // dispatchImportHandler(url)

	addImportHandler('.mmk', metamarkHandler)

	addImportHandler('.txt', metamarkHandler)

	addImportHandler('.js', function(url) {
		var returnValue
		try {								// console.log("loadScript "+ absurl)
			returnValue = loadScript(url)	// return value will be null
		} catch (err) {	 // console.log("err.message=",err.message,"err.name=",err.name,"err=",err)
			returnValue = markit('errorString',
				["Loading script '", url, "':\n\t", (err.message || err.name)].join(''));
			//ES6:   `Loading script '${absurl}' ${(err.message || err.name)}`))
		}
		return returnValue
	})

	addImportHandler('.css', function(url) {
		var returnValue
		try {
			var content = fileContent(url);  // needs to be synchronous or frame sizes get mucked up
			//i.e., this doesn't work: out.push(["<style scoped>@import url(", absurl, ");</style>"])
			returnValue = ["<style scoped>", content, "</style>"]
		} catch (err) { // IO Error
			returnValue = (markit('errorString', ["Reading '", url, "':\n\t", (err.message || err.name)].join('')))
		}
		return returnValue
	})

	function metamarkHandler(url) {
		var returnValue
		try {
			var content = fileContent(url);  	// needs to be synchronous or frame sizes get mucked up
			returnValue = markit('metamark', content);	// process metamark
		} catch (err) { // IO or markit Error
			returnValue = markit('errorString', ["Reading '", url, "':\n\t", (err.message || err.name)].join(''))
		}
		return returnValue
	} // function metamarkHandler(url)

	context.addTransform('metamark', function (content) {
		var html;
		try {       // all exceptions turned into errorString's
			html = metaword.flatten(metaword.parse(content)).join('')
		} catch (err) {
			html = markit('errorString', err.message)
		}
		return html
	});

	/*********** Everything below this line is predefined markup and could be re-located. **********/
	/*********** See "Dependancy:" comments for API requirements.                         **********/


	/*
	 *  6. Utility function to translate labeled content: toHTMLstring(label, content)
	 *      If no transform for label, use 'myword'
	 *  returns html string or null(no transform found for label)
	 *  throws errors from markit(transform, content))
	 */

	var toHTMLstring = function (label, content) {
		var htmlResult = null;   // default for no label definition
		var definition = resolve(label, true);     //; console.log(label,'::',definition,'\n',content)
		if (definition) {
			if (definition.beginTag.substr(-2) === '/>') // closed tag implies no content
				htmlResult = definition.beginTag;
			else {
				var transform = (definition.transform) ? definition.transform : 'myword';	//; console.log("transform=",transform)
				var html = markit(transform, content);										//; console.log(html)
				/*htmlResult = [definition.beginTag,
					((html != null) ? html : markit('text', content)),
					definition.endTag].join('')
				*/
				if (html != null) htmlResult = [definition.beginTag, html, definition.endTag].join('');
				//ES6:    `${definition.beginTag}${((html != null) ? html : content)}${definition.endTag}`
			}
		}
		return htmlResult
	}; // toHTMLstring(label, content, defaultType)

	function resolve(label, errorReport) {
		//**** Dependancy: context
		var labelDef = context.labelDef(label);					// {transform:typeInfo, tag:tagInfo}
		// console.log("label=",label,"labelDef=",labelDef)
		if (labelDef) {					// does label have definition record
			var transformName = labelDef.transform;
			var bTag, eTag, transform;
			if (context.transform(transformName)) {				// if a defined transform?
				bTag = labelDef.tag;
				eTag = endTag(bTag);
				transform = transformName
			} else {											// possible alias
				if (context.labelDef(transformName)) {			// if another label?
					var baseRes = resolve(transformName, errorReport);		//; console.log("baseRes=",baseRes)
					if (baseRes.beginTag) {
						if (labelDef.tag.charAt(0) === '<') {
							bTag = labelDef.tag;					// new full tag overwrites old one
							eTag = endTag(bTag)
						} else if (labelDef.tag) {				// more attributes?
							bTag = [baseRes.beginTag.slice(0, -1), ' ', labelDef.tag, '>'].join('');
							eTag = baseRes.endTag
						} else {
							bTag = baseRes.beginTag;
							eTag = baseRes.endTag
						}
					} else {
						bTag = labelDef.tag;						// no base tag, use this one
						eTag = endTag(bTag)
					}
					transform = baseRes.transform;				// alias uses type from base label
				} else {										// unknown type, just use tag
					if (transformName) {
						reportError([transformName," is undefined."]);
						return null;								// no label or transform def. for transformName
					} else {										// no transformName
						bTag = labelDef.tag;
						eTag = endTag(bTag);
						transform = null;						// null type will resort to default type
					}
				}
			}
			// console.log(label,'=>',bTag,transform,eTag)
			return {beginTag: bTag, endTag: eTag, transform: transform}
		} else {	// no label definition record
			if (errorReport && label) reportError([label," is undefined."]);
			return null
		}

		function endTag(beginTag) {
			return (beginTag && (beginTag.charAt(0) === '<')) ?
				((beginTag.lastIndexOf('/>') === (beginTag.length-2)) ? "" : ["</", beginTag.match(/^<\s*(\S+)[^>]*>$/)[1], ">"].join('')) :
				""
		} // endTag(beginTag)

	} // resolve(label, errorReport)


	/*
	 *  7. Transform: myword
	 *  create and translate block elements
	 */

	var myword = new Grit(
		"myword  := (blank / block / line)*         :: elems ",
		"block   := label (blank* offset line)+     :: block ",
		"blank   :~ [ \\t]* (?: \\n | \\r\\n?)      :: blank ",
		"line    :~ [^\\n\\r]* (?: \\n | \\r\\n?)?  :: line ",
		"label   :~ (\\S*)                          :: string ",
		"offset  :~ (\\t | [ ]{2,8})                :: string "
	);

	myword.elems = function(elems) {
		return this.flatten(elems);
	};

	// tab indented lines always have one tab removed
	// space indented lines have the minimum inset deleted (2..8)
	// if tabs and spaces are mixed a tab is taken to match 4 spaces.

	myword.block = function(label, lines) {
		label = label || "()"; // inset block with empty label
		var mix = false, fault = false; // tabs OR space insets
		var blockContent = function (lines) {
			// find minimum indentation...
			var nl = 0; // inset lines in block, may be 0
			var min = lines.reduce(function (m, ln) {
				// ln = [blank* offset line]
				nl += ln[0].length; // count {blank:s}
				if (m == 10 && nl === 0) return 9; // skip first offset after label
				var inset = ln[1].length; // 1=tab, 2..8=spaces
				if ((inset==1 && m<9)||(inset>1 && m==1)) mix = true; // mixed indents
				return ((inset > 1 && inset < m) ? inset : m);
			}, 10); // 1=tab, 2..8=min space inset, 9=no space inset lines, 10=first line
			if (mix) { // mixed tab and space insets..
				if (min%4 != 0) fault = true; // not 4-space insets
				min = 4; // default tab-stop
			};
			var txt = lines.reduce(function (txt, ln) {
				// ln = [blank* offset line]
				for (var n=0; n<ln[0].length; n++) { txt += "\n" }
				var inset = ln[1].length; // 1=tab, 2..=spaces
				if (inset <= min) return txt + ln[2].line;
				var indent = "               ".slice(0, inset - min);
				return txt + indent + ln[2].line;
			}, "");
			return txt;
		};
		var labelDef = context.labelDef(label);	 // {transform:typeInfo, tag:tagInfo}
		var content = blockContent(lines);
		if (labelDef && labelDef.transform === 'metamark') { // block of definitons...
			return { report: markit('metamark', content) };    // report errors
		}
		if (fault) console.log("Warning: "+label+" has mis-matched tab and space indents: "+content)
		return { label:label, content:content, mix:mix, fault:fault }
	};

	myword.blank = function(s) {
		return { blank: s }
	};

	myword.line = function(s) {
		return { line: s }
	};

	myword.string = function(_, s) {
		return s
	};

	compileGrammar(myword); // verify grammar, or throw an error

	var mywordParse = function(content) {
		var out = [];
		if (!content) return '';

		context = context.push();	// new context for myword blks

		context.blks = myword.parse(content);

		while (context.blks.length>0) {
			var blk = context.blks[0];

			if (blk.label) try {
					var html = toHTMLstring(blk.label, blk.content)		 // prose default, myword blocks must be explicit
				if (html) {
					out.push(html)
				} else { // undefined label or prose
					out.push("<dl><pre><dt><mark>"+markit('text',blk.label)+"</mark></dt><dd>"+
						markit('text',blk.content)+"</dd></pre></dl>")
				}
			} catch (err) {
				out.push(markit('errorString', err.message))
			}

			if (blk.line) { // line of prose...
				var proseContent = blk.line;
				context.blks.shift();   // consume block
				while (context.blks.length>0) { // collect lines in para..
					blk = context.blks[0];   // examine next block
					if (!blk.line) break;
					proseContent += blk.line;
					context.blks.shift();   // consume block
				}
				try {
					out.push(markit('prose', proseContent))
					if (blk.blank && context.blks.length > 1 && context.blks[1].line) {
						out.push('<div class=blank><br/></div>') // prose line separator
						context.blks.shift()  // consume blank line
					}
				} catch (err) {
					out.push(markit('errorString', err.message))
				}
				continue;
			}

			if (blk.blank) {
				// out.push('<div class=blank><br/></div>')
			}

			if (blk.report) {
				out.push(blk.report)
			}

			context.blks.shift();   // consume block
		} // while

		if (context.hasDefinitions()) {
			contextList.push(context) // preserve this context and wrap the output
			out.unshift(['<div class=myword data-context=',(contextList.length-1).toString(),'>'])
			out.push('</div>')
		}

		context = context.pop();						// restore previous context

		return myword.flatten(out).join('');			// return single string from meta content and joined array
	};


// define labels and types for blocks

	context.addTransform('myword', mywordParse); //  **** Dependancy: context, compileGrammar()

	context.addTransform('list', function(content) {	// transform for list grouping:
		//**** Dependancy: context
		var groupBlocks = function() { // content of next in group ...
			var currentblk = context.blks[0];
			var blk = context.blks[1];                      // look ahead
			while (blk && blk.blank) {                     // remove blanks
				context.blks.splice(1,1);
				blk = context.blks[1];
			}
			if (blk) {
				if (blk.label == currentblk.label) {
					context.blks.shift();               // remove current block, matching block now first
					return blk.content;                 // return block content
				}
			}
			return null
		}; // groupBlocks()

		var out = [];
		while (content) {       //; console.log("grouping:",content)
			try {
				out.push("<li>", markit('myword', content), "</li>");
			} catch (err) {
				out.push(markit('errorString', err.message))
			}
			content = groupBlocks();
		}
		return out.join('');
	});

	context.addTransform('include', function(content) { // transform for including content in external resources
															 //**** Dependancy: I/O utilities, context via resolve
		var out = [];                        //; console.log('@import',content)
		var absurl, url, urlist = content.trim().split(/\s+/);
		for (var u=0; u < urlist.length; u++) {
			url = urlist[u];
			absurl = composeURL(url);	//; console.log('@import ',absurl)
			loadpath.unshift(directory(absurl));			// push new loadpath
			try {
				var fcontent = fileContent(absurl);
				// if there's a label defined for the URL suffix, use its transform, else use 'myword' transform
				var html = toHTMLstring(url.substring(url.lastIndexOf('.')), fcontent)
				if (html)
					out.push(html);
				else
					out.push(markit('myword', fcontent));  // apply 'myword' if no label defined for suffix
			} catch (err) { // IO or translateData Error
				out.push(markit('errorString', ["Reading '", absurl, "':\n\t", (err.message || err.name)].join('')))
			}
			loadpath.shift();							// pop loadpath
		}
		return out.join('')
	});

	//context.addLabelDef('&', {transform:'metamark', tag:""});
	//context.addLabelDef('@include', {transform:'include', tag:""});


	/*
	 *  8. Transform: proseParse(content)
	 *  create and translate inline elements
	 */

	var sigilProse = new Grit(
		"prose       := (element / text)*                                       :: prose ",
		"element     := label content                                           :: element ",
		"content     := (open_p content_p close_p) / (open_b content_b close_b) :: content ",
		"content_p   := (paren / char_p)* ",
		"paren       := open_p content_p close_p ",
		"content_b   := (brack / char_b)* ",
		"brack       := open_b content_b close_b ",
		"label       :~ [^\\sA-Za-z0-9()\\[\\]]+ [A-Za-z0-9_-]*                  :: text ",
		"text        :~ [\\s\\S] (?:[^ \\(\\[]*\\s+)* [\\sA-Za-z0-9()\\[\\]]*    :: text ",
		"open_p      :~ [\\(] ",
		"close_p     :~ [\\)] ",
		"char_p      :~ [^)] ",
		"open_b      :~ [\\[] ",
		"close_b     :~ [\\]] ",
		"char_b      :~ [^\\]] "
	);

	sigilProse.prose = function(content) {
		return this.flatten(content).join('');
	};

	sigilProse.element = function(label, content) {
		var html;
		try {
			html = markit.withLabel(label, content)		// use internal toHTMLstring() if withLabel() removed from API
		} catch (err) {
			html = markit('errorString', err.message)
		}
		if (!html) {
			html = ["<span style='font-family:monospace'><mark>", markit('text', label), "</mark>[", markit("text", content), "]</span>"];
		}
		return html;
	};

	sigilProse.content = function(content) {
		return this.flatten(content[1]).join('');
	};

	sigilProse.text = function(content) {
		return markit('text', content);
	};

	compileGrammar(sigilProse); // verify grammar, or throw an error

	var proseParse = function(content) {
		return sigilProse.parse(content);
	}; // proseParse(content)

	context.addTransform('prose', proseParse);       // transform for prose,  **** Dependancy: context, compileGrammar()


	/*
	 *  9. export.....
	 */
	markit.withLabel = toHTMLstring;
	if (typeof module !== 'undefined' && typeof exports === 'object') {
		module.exports = markit;
	} else if (typeof define === 'function' && define.amd) {
		define(function () {
			return markit;
		});
	} else
		this.markit = markit;   // global translator markit(transformName, content)

//}();
}).call(function() {
	return this || (typeof window !== 'undefined' ? window : global);
}());
