@doc .myw
	####  Package `tsv.mmk`
	
	"[Tab-separated values]" (or `tsv`) is a common text format used for storing data in a tabular structure. The
	`tsv.mmk` package provides a type defintion for `tsv` which converts `tsv` formatted text  to an HTML table. To
	improve readability, this version of `tsv` defines a field separator to be multiple tabs so that it's easier to
	align columns in the source. The downside is that it's not possible to express an empty field by two successive
	tabs; in this case just use a space.

	Each line of `tsv` content represents a row of the table and consists of "fields" separated by one or more tabs.
	The contents of the field are of type `prose` since the use of any block structured content would conflict with
	`tsv` parsing.  The package also includes some basic style rules for the `table.my_array` element generated by the
	transform.

	Note: To render this documentation, define:
	eg
		metadoc :: (doc) => markit('myword', doc.replace(/(\n|\r\n?)(\t|[ ]{4})/g, '\n'))
	and `@import` this package.
	
	&
		[Tab-separated values] <- link https://en.wikipedia.org/wiki/Tab-separated_values

.tsv ..      <- tsv
tsv          := row*             :: (rows) => `<table class=my_array>${rows.join('')}</table>`
	row      := cell* nl?        :: (cells) => `<tr>${cells.flat(Infinity).join('')}</tr>`
	cell     := item tsep?       :: (item) => `<td>${markit('prose',this.flatten(item).join(''))}</td>`
	item     := (!delim char)+
	delim    :~ %tsep | %nl
	tsep     :~ [\t]+
	nl       :~ [\n\f]|([\r][\n]?)
	char     :~ [\s\S]

@css
	table.my_array {border-collapse:collapse;}
	table.my_array td {border:thin solid gray; padding:2pt 10pt;}

@doc .myw
	A simple example:
	demo
		.tsv
			A	B	C
			a1	b1	c1
			a2	b2	c2
	With a different presentation:
	demo
		.tsv
			**A**	**B**	**C**
			 a1		 b1		 c1
			 a2		 b2		 c2
		&
			@css
				table.my_array { border-collapse:collapse; }
				table.my_array tr td { background:whitesmoke; padding: 8px 32px; }
				table.my_array tr:nth-child(1) td { background:lightgray; }

	Place-holders can be used for defining complicated cell contents, i.e., any content that would conflict with the
	`tsv` parser. In general, place-holders are also shorter which helps with the alignment of table cells in the source.
	demo
		.tsv
			 				**Line**		**Plane**		**Shape**
			**Size**		length			area			volume
			**Dimensions**	1				2				3
			**Extras**		[linedesc]		[HTML Tables]	[top-hat]
		&
			[linedesc] <- viz
				Defined by a beginning
				and an end `point`.
			[HTML Tables] <- link https://css-tricks.com/complete-guide-table-element/
			[top-hat] <- is &#127913;
			@css
				table.my_array { border-collapse:collapse; }
				table.my_array tr td { background:whitesmoke; padding: 4px 16px; }
				table.my_array tr:nth-child(1) td { background:lightgray; }
