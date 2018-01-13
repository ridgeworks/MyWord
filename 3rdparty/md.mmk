@doc
 Define type `md` for Markdown content- uses https://github.com/chjj/marked
 Examples:	Defines type 'gv' (Graphviz file suffix) for use in notations or typed blocks, e.g.,
	demoS
		.md
			A First Level Header
			====================

			A Second Level Header
			---------------------

			The quick brown fox jumped over the lazy
			dog's back.

			### Header 3

			> This is a blockquote.
			>
			> ## This is an H2 in a blockquote
			This is an [example link](http://example.com/).

			Optionally, you may include a title attribute in the parentheses:

			This is an [example link](http://example.com/ "With a Title").

			Reference-style links allow you to refer to your links by names, which you define elsewhere in your document:

			I get 10 times more traffic from [Google][1] than from
			[Yahoo][2] or [MSN][3].

			[1]: http://google.com/        "Google"
			[2]: http://search.yahoo.com/  "Yahoo Search"
			[3]: http://search.msn.com/    "MSN Search"

@import marked.js

.md .. <- md
md     :: (markdown) => marked(markdown)
