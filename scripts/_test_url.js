// Quick test of billIdToCongressGovUrl
function billIdToCongressGovUrl(rawId, congress) {
    if (!rawId || !congress) return "";
    var id = rawId.replace(/[.\s]/g, "").toUpperCase().trim();
    var typeMap = {
      "HR": "house-bill", "S": "senate-bill",
      "HRES": "house-resolution", "SRES": "senate-resolution",
      "HJRES": "house-joint-resolution", "SJRES": "senate-joint-resolution",
      "HCONRES": "house-concurrent-resolution", "SCONRES": "senate-concurrent-resolution"
    };
    var prefixes = ["HCONRES","SCONRES","HJRES","SJRES","HRES","SRES","HR","S"];
    for (var i = 0; i < prefixes.length; i++) {
      if (id.indexOf(prefixes[i]) === 0) {
        var num = id.substring(prefixes[i].length);
        if (num && /^\d+$/.test(num)) {
          var c = parseInt(congress, 10);
          var suffix = c === 1 ? "st" : c === 2 ? "nd" : c === 3 ? "rd" : "th";
          return "https://www.congress.gov/bill/" + c + suffix + "-congress/" + typeMap[prefixes[i]] + "/" + num;
        }
      }
    }
    return "";
}

var tests = [
  ["HR29", "119"],
  ["HRES5", "119"],
  ["HJRES42", "119"],
  ["S100", "119"],
  ["H.R. 29", "119"],
  ["S. 100", "119"],
  ["", "119"],
  ["HR29", ""],
  ["HR29", 119],
];
tests.forEach(function(t) {
  console.log(JSON.stringify(t[0]) + ", " + JSON.stringify(t[1]) + " => " + billIdToCongressGovUrl(t[0], t[1]));
});
