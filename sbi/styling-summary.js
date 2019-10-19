// ==UserScript==
// @name         sbisec - styling summary
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  口座サマリーを見やすくする (米国株のみ対応)
// @author       yuzu
// @match        https://global.sbisec.co.jp/Fpts/czk/accountSummary/
// @grant        none
// @require      https://code.jquery.com/jquery-3.4.1.min.js
// ==/UserScript==

const style = {
  'fontSize'       : '120%',
  'fontColorProfit': 'rgb(20, 190, 20)',
  'fontColorLoss'  : 'red',
}

;//main
(() => {
  'use strict'

  $('#main').css('font-size', style.fontSize)

  let totalProfit = 0
  let totalValue  = 0

  // 各行に色付け & 合計を求める
  $('#main > div.lo2clm01.mgt20t > div.lo2clm01R01 > table > tbody > tr:nth-child(even) > td:nth-child(4)').each((_, i) => {
    const [usdProfit, usdValue, jpyProfit, jpyValue] = $(i).text().trim().split(/\s+/)
    console.log({usdProfit, usdValue, jpyProfit, jpyValue})
    $(i).css(
      'color',
      usdProfit.indexOf('-') >= 0 ? style.fontColorLoss : style.fontColorProfit,
    )

    totalProfit += parseFloat(usdProfit.replace('USD', ''))
    totalValue  += parseFloat(usdValue.replace('USD', ''))
  })

  // 少数点以下で四捨五入するために桁上げして round
  totalProfit = Math.round(totalProfit * 100) / 100
  totalValue  = Math.round(totalValue  * 100) / 100

  const profitPercentage = Math.round(10000 * totalProfit / totalValue) / 100

  // 合計行を追加
  $('#main > div.lo2clm01.mgt20t > div.lo2clm01R01 > table > tbody').append(`
    <tr><td colspan=4
            style="text-align: right; color: ${totalProfit >= 0 ? style.fontColorProfit : style.fontColorLoss}"
        >
          total: ${totalProfit} USD (${profitPercentage}% of ${totalValue} USD)
    </td></tr>`
  )
})()
