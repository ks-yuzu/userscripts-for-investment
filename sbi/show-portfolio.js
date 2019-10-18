// ==UserScript==
// @name         sbisec - show portfolio
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  ポートフォリオのグラフを表示する (米国株のみ対応, 円換算)
// @author       Yuzu
// @match        https://global.sbisec.co.jp/Fpts/czk/accountSummary/*
// @grant        none
// @require      https://code.jquery.com/jquery-3.4.1.min.js
// ==/UserScript==


(async () => {
  function getDataForGraph() {
    // 参考レート
    const usdjpy = $('#main > div.lo2clm01.mgt20t > div.lo2clm01L01 > div > ul > li > b').text()
    // 買付余力
    const usdCash = $('#main > div.lo2clm01.mgt20t > div.lo2clm01L01 > table:nth-child(2) > tbody > tr:nth-child(1) > td.alR').text().replace('USD', '') * usdjpy
    const jpyCash = $('#main > div.lo2clm01.mgt20t > div.lo2clm01L01 > table:nth-child(2) > tbody > tr:nth-child(10) > td.alR').text().replace(/\D+/g, '')

    const rows = $('#main > div.lo2clm01.mgt20t > div.lo2clm01R01 > table > tbody > tr')
    const data = []
    for(let i = 0; i < rows.length; i += 2 ) {
      const tickerCell = $(rows[i]).find('td:nth-child(1)').text().trim().split('\n')[8]
      if ( !tickerCell ) { continue }
      const ticker = tickerCell.split(/\s+/)[1]

      const value = $(rows[i+1]).find('td:nth-child(3)').text().replace('USD', '')
      const num = $(rows[i+1]).find('td:nth-child(1)').text().replace(/\D+/g, '')
      data.push({ label: ticker, y: num * value * usdjpy })
    }

    return [
      ... data.sort((a, b) => b.y - a.y),
      { label: 'JPY', y: jpyCash },
      { label: 'USD', y: usdCash },
    ]
  }

  function sleep(sec) {
    return new Promise(resolve => setTimeout(resolve, sec * 1000))
  }

  $('head').append(`
    <script src="https://cdnjs.cloudflare.com/ajax/libs/canvasjs/1.7.0/canvasjs.min.js"></script>
  `)

  $('body').append(`
    <div id="graph" style="position: fixed; top: 120px; left: 0; z-index: 20"></div>
  `)

  const data = getDataForGraph()
  const total = data.reduce( (a, b) => a + parseInt(b.y), 0 )

  do {
    await sleep(0.1)
  } while ( typeof CanvasJS === 'undefined' )

  let chart = new CanvasJS.Chart(
    document.getElementById('graph'),
    {
      animationEnabled: true,
      theme: "dark1",
      width: 420,
      backgroundColor: "rgba(0, 0, 0, 0)",
      data: [{
        type: 'pie',
        dataPoints: data,
        startAngle: 270,
        indexLabel: "{label} {y}",
        yValueFormatString: "###,###,###,###",
      }],
      title: {
        text: `total: ${total}`,
      }
    }
  )
  chart.render()
})()

