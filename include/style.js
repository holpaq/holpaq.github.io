if (!String.prototype.supplant) {
    String.prototype.supplant = function (o) {
        return this.replace(/{([^{}]*)}/g, (a, b) => {
            let r = o[b];
            return typeof r === 'string' || typeof r === 'number' ? r : a;
        });
    };
}

// From: https://codereview.stackexchange.com/a/132140/197081
{
    String.prototype.rot13 = function() {
        return this.split('').map(x => lookup[x] || x).join('');
    }
    let input  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
    let output = 'NOPQRSTUVWXYZABCDEFGHIJKLMnopqrstuvwxyzabcdefghijklm'.split('');
    let lookup = input.reduce((a, k, i) => Object.assign(a, {[k]: output[i]}), {});
}

/******************************************************************************/

const scriptPath = getRelativeScriptPath();

include(scriptPath + "jquery-3.5.1.slim.min.js", afterjQueryLoad);

function afterjQueryLoad() {
    // jQuery .reduce() plugin (from https://bugs.jquery.com/ticket/1886)
    jQuery.fn.reduce = [].reduce;

    $('html').attr('lang', 'en');                     // set document language
    if (window.location.search.match(/\bDEBUG\b/i)) { // set 'class=DEBUG'
        $('html').addClass('DEBUG');
    }

    include(scriptPath + "showdown.min.js", afterShowdownLoad);
}

// Enable 'Show page' button when showdown has loaded.
function afterShowdownLoad() {
    let $btn = $('button');
    $btn.removeAttr('disabled')
        .focus()
        .on('click', () => {
            // Display (CSS only) wait animation.
            $btn.html('<div class="loading"><div></div><div></div><div></div><div></div></div>');
            // Run main() then remove button.
            setTimeout(() => {
                main(window.jQuery);
                $btn.remove();
            }, 100);
        });
}

/******************************************************************************/

// Load Javascript, then invoke callback function.
function include(url, callback) {
    var tag;
    if (url.match(/\.css$/i)) {                 // CSS
        tag = document.createElement("link");
        tag.rel = "stylesheet";
        tag.href = url;
    } else if (url.match(/\.js$/i)) {           // Javascript
        tag = document.createElement("script");
        tag.src = url;
    } else {
        throw TypeError(
            "include(): Unknown file type '" + url.split(".").pop() + "'"
        );
    }
    tag.async = true;
    tag.onload = callback;
    document.getElementsByTagName("head")[0].appendChild(tag);
}

// Get Javascript path. (Path name relative to the page the script was included
// on.)
function getRelativeScriptPath() {
    // Lists with each path component for element (removing trailing filename).
    let [script, page] = [
        document.currentScript.src.split("/").slice(0, -1), // page url
        document.location.href    .split("/").slice(0, -1), // script url
    ];
    // Remove leading common parts.
    while (script.length > 0 && page.length > 0 && script[0] === page[0]) {
        script.shift();
        page.shift();
    }
    return [].concat(
        // Replace remaining page path elements with '..'.
        page.length > 0 ? page.map(() => "..") : ["."],
        script,
    ).join("/") + "/";
}

function asciify(txt) {
    return txt
        .normalize("NFD")                  // turn accents into own chars
        .replace(/[^a-z0-9\n\r -]/gui, "") // strip off non A-Z, space or hyphen
        .replace(/\s+/gu, "-")
        .toLowerCase();
}

/******************************************************************************/

function main($) {
    const $elem = $('[markdown]:first');   // 1st element with attr 'markdown'
    const singleRefReStr = '\\[([^\\[\\]]+)\\]:\\s*(\\S+)(?:\\s+"([^"]*)")?\\n';
    const onlyReferences = new RegExp("^(" + singleRefReStr + ")+$");
    const oneReference = new RegExp(singleRefReStr);

    // Get & preprocess markdown.
    let refs = {};
    const text = ($elem.text() || "")
          [$elem.is('[rot13]') ? 'rot13' : 'toString']() // rot13 decode
          .split(/\n{2,}/).map((paragraph) => {
              if ((paragraph + "\n").match(onlyReferences)) {
                  // Paragraph containing only link references.
                  let refName = "";
                  (paragraph + "\n").split(oneReference).forEach((str, i) => {
                      //str = (str || "").replace(/\s+/g, " ");
                      switch (i % 4) {
                      case 0:
                          if (str !== "") { throw "Bad string"; }
                          break;
                      case 1:
                          refName = str.replace(/&(amp|gt|lt);/, (_, a) => {
                              return { amp: "&", gt: ">", lt: "<" }[a];
                          });
                          if (refs[refName] !== undefined) {
                              throw "Source reference '" + refName + "' already exists!";
                          }
                          refs[refName] = [];
                          break;
                      default:
                          refs[refName].push(str);
                      }
                  });
                  return "";
              } else {
                  // Put <blockquote> around paragraphs where all lines start with '>'.
                  let lines = paragraph.split(/\n/g);
                  if (lines.every((a) => (/^\s*&gt;/.test(a)))) {
                      paragraph = "<blockquote>" +
                          paragraph.replace(/^\s*&gt;\s*/mg, '') +
                          "</blockquote>";
                  }

                  // If all lines start with '|'.
                  if (lines.every((a) => (/^\s*\|/).test(a))) {
                      // Number of columns in each line.
                      let cols = lines.map(
                          (str) => ((str || "").match(/\|/g) || []).length
                      );
                      let maxcols = Math.max(...cols);

                      paragraph = "<table class=example>" + lines.map(
                          (str, i) => "<tr>" + (
                              cols[i] == 1
                                  ? "<td colspan='" + maxcols + "'>" +         // single '|' in line
                                  str.replace(/^\s*\|\s*/, "")             //   remove leading '|'
                                  : str.replace(                               // multiple '|'
                                      /\s*\|\s*(&nbsp;)*\s*/g,
                                      (_, nbsp) => nbsp ? "<td indent>" : "<td>"
                                  )
                          )
                      ).join("") + "</table>";
                  }

                  // Text paragraphs.
                  return paragraph
                      // {...} = Klingon.
                      .replace(/\{(.*?)\}/gs, (_, tlh) => {
                          return "<b lang=tlh>" +
                          // Insert <nobr> around leading '-' & following word.
                          tlh.replace(/(-[^ ]+)/, "<nobr>$1</nobr>") +
                          // FIXME: Hyphenate klingon here?
                          "</b>"
                      })
                      .replace(/\[[^\[\]]*\]/g, (str) => str.replace(/\s+/g, " "))
                      .replace(/\n\s*\[/g, " [");
              }
          }).filter((a) => a).concat(
              // Add (previously removed) link references at end of markdown.
              Object.keys(refs).sort().map((name) => {
                  const [fullLink, title] = refs[name];
                  const [link, pageOffset] = fullLink
                        .match(/^(.*?)([+-][0-9]+)?$/).slice(1);
                  refs[name].push(parseInt(pageOffset, 10) || 0);
                  refs[name][0] = link;
                  return (
                      title === "" ? '[{0}]: {1}' : '[{0}]: {1} "{2}"'
                  ).supplant([ name, link, title ]);
              }).join("\n")
          ).join("\n\n");

    // https://github.com/showdownjs/showdown/wiki/Showdown-Options
    showdown.extension('en', {
        type: 'lang',
        filter: (md) => md.replace(/«([^»]+)»/g, '<i class=transl>$1</i>'),
    });
    const markdown = new showdown.Converter({
        extensions        : ['en'],
        tables            : true,
        strikethrough     : true,
        simplifiedAutoLink: true,
    });
    $elem.replaceWith(                      // replace with markdown
        markdown.makeHtml(text)
    );

    // Add ID attribute to <h#> tags.
    $("h1,h2,h3,h4,h5,h6,h7").each((_, h) => {
        const $h = $(h);
        $h.attr("id", asciify($h.text()));
    });

    // Add ID attribute to paragraps of term list.
    // (Paragraphs containing <strong> as 1st child, and <em> as second.)
    $("[terms] > p").each((_, p) => {
        let $p = $(p);
        let $termSv = $p.find(":nth-child(1)");
        let $termEn = $p.find(":nth-child(2)");
        if ($termSv.is("strong") && $termEn.is("em")) {
            $p.attr({ id: asciify($termSv.text()) });
        }
    });

    // Replace remaining [TEXT] and [TEXT][…] with links.
    const existingId = $("[id]").reduce((acc, elem) => {
        acc[ $(elem).attr("id") ] = true;
        return acc;
    }, {});
    $("body *:not(script)").contents().each((_, node) => {
        if (node.nodeType !== 3) {              // only process text nodes
            return;
        }
        const $node = $(node);
        const html = $node.text()               // split into text & links
              .split(/(\[.*?\](?:\[.*?\])?)/s);
        if (html.length > 1) {
            const newHtml = html.map((full, i) => {
                if (!(i % 2)) { return full; }  // plain text elements

                const [, desc, rawLink=desc] = full
                    .replace(/\n+/g, " ")       // newline = space
                    .match(/\[(.*?)\](?:\[(.*?)\])?/s);

                // Find (and remove) pageref (format :NUM1[–NUM2]).
                let startPage = 0;
                const linkref = rawLink.replace(
                    /:([0-9]+)(?:–[0-9]+)?\b/,
                    (_, n) => {
                        startPage = parseInt(n, 10);
                        return "";
                    });

                const anchor = asciify(linkref);
                if (refs[linkref]) {
                    // External link.
                    let [extlink, comment, pageOffset] = refs[linkref];
                    return "<a href='{0}{1}'>{2}</a>".supplant([
                        extlink,
                        startPage ? "#page=" + (startPage + pageOffset) : "",
                        desc,
                    ]);
                } else if (existingId[anchor]) {
                    // Links internal to the page.
                    return "<a href='#" + anchor + "'>" +  desc + "</a>";
                }
                return full;
            }).join("");
            $node.replaceWith(newHtml);
        }
    });

    function escapeHtml(text) {
        'use strict';
        return text.replace(/[\"&<>]/g, function (a) {
            return { '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;' }[a];
        });
    }

    // Add ID attribute to <h#> tags.
    (() => {
        let $toc = $("toc");
        var tocAttrs = $.map(
            $toc.prop("attributes"),
            (x) => " " + x.name +
                (x.value === undefined ? "" : '="' + escapeHtml(x.value) + '"')
        ).join("");

        if ($toc.length === 0) { return; }
        let level = 0;
        let html = "";
        $("h1,h2,h3,h4,h5,h6,h7").each((_, h) => {
            let $h = $(h);
            if ($h.attr('title') === "") {   // skip if 'title' attribute is used
                return;
            }
            let num = $h.prop("tagName").match(/\d$/)[0];
            if (!level) { level = num; }
            if (num > level) {
                //console.log("DEEPER");
                html += (new Array(num - level + 1)).join("<ul>\n");
            } else if (num < level) {
                //console.log("SHALLOWER");
                html += (new Array(level - num + 1)).join("</ul>\n");
            }
            level = num;
            let z = "<li class='h{level}' hanging><a href='#{link}'>{text}</a>\n".supplant({
                level: num,
                text: $h.html().replace(/[^<]\//g, (x) => x + "<wbr>"),
                link: $h.attr("id"),
            });
            //console.log(num, z);
            html += z;
        });
        $toc.replaceWith(
            "<ul class=toc" + tocAttrs + " style='padding-top:0'>" + html + "</ul>"
        );
    })();

    // Add 'target="_blank"' to all external links.
    $("a[href]:not([href^='#'])").attr("target", "_blank");
}

/*[eof]*/
