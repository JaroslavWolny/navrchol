/**
 * Dorovnání horní bezpečné zóny.
 *
 * iOS ji umí započítat dvakrát: okno appce o zónu zkrátí (naměřeno 393×793
 * místo 393×852 na iPhonu 15 Pro), ale `env(safe-area-inset-top)` dál hlásí
 * plnou hodnotu. Kdo jí uvěří, posune obsah zbytečně nízko a dole mu zbyde
 * pruh, kam webové okno vůbec nedosáhne.
 *
 * Proto se zóna nebere na slovo, ale porovná se s tím, o kolik je okno
 * menší než obrazovka. Když už si ji iOS ukrojil, appka ji nepřidává.
 */
export function applySafeTop(): void {
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;' +
    'padding-top:env(safe-area-inset-top,0px)'
  document.body.appendChild(probe)
  const reported = parseFloat(getComputedStyle(probe).paddingTop) || 0
  probe.remove()

  document.documentElement.style.setProperty('--safe-top', `${resolveSafeTop(reported)}px`)
}

/** Oddělené od DOM, aby se to dalo testovat. */
export function resolveSafeTop(
  reported: number,
  innerHeight: number = window.innerHeight,
  screenHeight: number = Math.max(window.screen.width, window.screen.height),
): number {
  if (reported <= 0) return 0

  const shortfall = screenHeight - innerHeight
  // Na šířku je horní zóna nulová a rozdíl obrovský — tam se nekoriguje.
  if (shortfall > 160) return reported
  // Okno je kratší zhruba o tu samou zónu, kterou iOS hlásí: už si ji ukrojil.
  if (shortfall >= reported - 6) return 0
  return reported
}

/** Sleduje otočení a změny okna, protože zóny se s nimi mění. */
export function watchSafeArea(): void {
  applySafeTop()
  window.addEventListener('resize', applySafeTop)
  window.addEventListener('orientationchange', applySafeTop)
}
