@doc
	###	`tables.mmk`
	The variety of tables possible in HTML is almost limtless (see [A Complete Guide to the Table Element]) and most users will have their own special requirements. This package defines a simple table that can be input as a array of tab separated text fields. The `tsvarray` transform can translate this source text into the table-row and table-data elements that rae then placed inside an HTML table element. As implemented, this transform will accept one or more tabs, or two or more spaces, as a "tab separator".
	
	&	[A Complete Guide to the Table Element] <- link https://css-tricks.com/complete-guide-table-element/

tsvtable ..  <- <table class=array> tsvarray

tsvarray     := row*             :: (rows) => this.flatten(rows).join('')
	row      := tsep* cell* nl?  :: (_,cells) => (cells.length>0)? ["<tr>",cells,"</tr>"] : ''
	cell     := item tsep?       :: (item) => ["<td>",markit('myword',this.flatten(item).join('')),"</td>"]
	item     := (!delim char)+
	delim    :~ %tsep | %nl
	tsep     :~ ([ ]*[\t]|[ ]{2,}) [ \t]*
	nl       :~ [\n\f]|([\r][\n]?)
	char     :~ [\s\S]

@css
	table.array {border-collapse:collapse;}
	table.array td {border:thin solid gray; padding:2pt 10pt;}

// This @doc block must appear after the defintions to use them.
@doc
	Some examples (note - requires the `demo.mmk` package):
	demo
		tsvtable
			A	B	C
			a1	b1	c1
			a2	b2	c2
	`tsvtable` wraps the table elments in a `<table class=array>` element and comes with simple CSS styling. Users can use the class attribute as shown to customize the presentation of the table.
	demo
		tsvtable
			A	B	C
			a1	b1	c1
			a2	b2	c2
		&
			@css
				.array { border-collapse:collapse; }
				.array tr td { background:whitesmoke; padding: 8px 32px; }
				.array tr:nth-child(1) td { background:lightgray; font-weight:bold; border-bottom: thin solid gray;}
	
	`[ .. ]` placeholders can be used for defining complicated cell contents, e.g., pargraphs containg significant white space that would disrupt the parsing of the `tsv` data, or rich content like images.
	demo
		tsvtable
			[-]				**Line**	**Plane**	**Shape**
			**Size**		length		area		volume
			**Dimensions**	1			2			3
			**Extras**		[linedesc]	[cat]		–
		&
			[cat] <- image images/octocat-icon.png
			[linedesc] <- viz
				Defined by a beginning 
				and an end `point`.
			[-] <- is &nbsp; 
			