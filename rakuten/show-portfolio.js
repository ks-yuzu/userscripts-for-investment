// ==UserScript==
// @name         rakuten-sec - show portfolio
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  "保有商品・資産状況確認 > すべて" のページでグラフを表示する (米国株/投信のみ動作確認, 円換算)
// @author       yuzu
// @match        https://member.rakuten-sec.co.jp/app/ass_all_possess_lst.do;BV_SessionID=*
// @grant        none
// ==/UserScript==
// ↓を入れると詳細表示が (崩れて) 評価情報が一覧になる
// @require      https://code.jquery.com/jquery-3.4.1.min.js

function sleep(sec) {
  return new Promise(resolve => setTimeout(resolve, sec * 1000))
}


function trimQuote (str) {
  return str.replace(/^"/, '').replace(/"\s*$/, '')
}


function makeHash (keys, values) {
  const hash = {}
  for ( const i in keys ) {
    hash[ (keys[i]||'').trim() ] = (values[i]||'').trim()
  }
  return hash
}


async function getData() {
  const sessionId = document.URL.match(/BV_SessionID=(.*?)\?/)[1]
  const res = await fetch(`https://member.rakuten-sec.co.jp/app/ass_all_possess_lst.do;BV_SessionID=${sessionId}?eventType=csv`)
  const buf = await res.arrayBuffer()
  const td = new TextDecoder('Shift-JIS')
  const csv = td.decode(buf)

  const data = {}
  let category
  let header

  for ( let line of csv.split('\n') ) {
    // console.log(line)
    if ( line.match(/^\s*$/) ) { continue }

    let matched

    // タイトル行の場合は現在のカテゴリを更新し, テーブルヘッダをリセット
    if ( matched = trimQuote(line).match(/^■(.*)/) ) {
      category = matched[1]
      header = undefined
      if ( category === '参考為替レート') {
        header = ['currency', ',', 'rate', ',', 'unit', ',', 'time']
      }
    }
    else {
      const matched = line.match(/(?<=")(.*?)(?="),?/g)

      // ヘッダ行ならヘッダ情報を保存して次へ
      if ( !header ) {
        header = matched
        if ( category === '資産合計欄' ) {
          header[0] = '種別'    // csv そのままでは空なので消えないように
        }
        continue
      }

      // (必要ならカテゴリ作成して) データ追加
      if ( !data[category] ) { data[category] = [] }
      data[category].push( makeHash(header, matched) )
    }
  }

  return data
}


async function getDataForCategoryGraph(data) {
  return data['資産合計欄']
    .filter((i) => i['時価評価額[円]'] !== '0')
    .filter((i) => i['種別'].indexOf('合計') === -1)
    .map((i) => ({
      label: i['種別'],
      y:     i['時価評価額[円]'].replace(/,/g, ''),
    }))
    .sort((a, b) => b.y - a.y)
}


async function getDataForUsStockGraph(data) {
  return data[' 保有商品詳細 (すべて）']
    .filter((i) => i['種別'] === '米国株式')
    .map((i) => ({
      label: i['銘柄コード・ティッカー'],
      y:     i['時価評価額[円]'].replace(/,/g, ''),
    }))
    .sort((a, b) => b.y - a.y)
}


async function getDataForInvestmentTrust(data) {
  return data[' 保有商品詳細 (すべて）']
    .filter((i) => i['種別'] === '投資信託')
    .map((i) => ({
      label: i['銘柄'],
      y:     i['時価評価額[円]'].replace(/,/g, ''),
    }))
    .sort((a, b) => b.y - a.y)
}


async function renderGraph(elmId, title, data) {
  while ( typeof CanvasJS === 'undefined' ) {
    await sleep(0.1)
  }

  let chart = new CanvasJS.Chart(
    document.getElementById(elmId),
    {
      animationEnabled: true,
      theme: "dark1",
      width: 400,
      backgroundColor: "rgba(0, 0, 0, 0)",
      data: [{
        type: 'pie',
        dataPoints: data,
        startAngle: 270,
        indexLabel: "{label} {y}",
        yValueFormatString: "###,###,###,###",
      }],
      title: { text: title }
    }
  )
  chart.render()
}


;//main
(async () => {
  $('head').append(`
    <script src="https://cdnjs.cloudflare.com/ajax/libs/canvasjs/1.7.0/canvasjs.min.js"></script>
  `)

  $('body').append(`
    <div id="graph-category" style="position: fixed; top: 50px; left: 0; z-index: 20"></div>
    <div id="graph-us-stock" style="position: fixed; top: 500px; left: 0; z-index: 20"></div>
    <div id="graph-investment-trust" style="position: fixed; top: 50px; right: 400px; z-index: 20"></div>
  `)

  let allData
  do { // 遅延読込を待つ
    await sleep(1)
    allData = await getData()
  } while ( allData['資産合計欄'][0]['時価評価額[円]'] === '-' )

  for ( const p of [
    {
      getDataFunc: getDataForCategoryGraph,
      elmId: 'graph-category',
      title: (total) => `カテゴリ別 (${total} JYP)`,
    },
    {
      getDataFunc: getDataForUsStockGraph,
      elmId: 'graph-us-stock',
      title: (total) => `米国株 (${total} JYP)`,
    },
    {
      getDataFunc: getDataForInvestmentTrust,
      elmId: 'graph-investment-trust',
      title: (total) => `投資信託 (${total} JYP)`,
    },
  ]) {
    const data  = await p.getDataFunc(allData)
    const total = data.reduce( (a, b) => a + parseInt(b.y), 0 )
    await renderGraph(p.elmId, p.title(total.toLocaleString()), data)
  }

  $('.canvasjs-chart-credit').hide()
})()


