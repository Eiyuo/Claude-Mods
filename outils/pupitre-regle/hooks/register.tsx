import type { Register } from 'claude-code'

// Recalage du pupitre (servi le 04/11/2026) : au-dessus de la bande, une règle et les textes de la jauge surlignés, à
// mesurer sur une capture. Bleu : 20 colonnes ; rouge : une image de 160 px (donne l'agrandissement de la capture) ;
// noir : deux colonnes séparées d'un écart. Les textes sont ceux de MESURES, dans pupitre/tests/bande.test.tsx.
const JAUNE = '#FDE68A'
const TEXTES: [string, boolean][] = [
  ['Contexte', false], ['Limite 5 h', false], ['Limite 7 jours', false], ['5 h', false], ['7 jours', false],
  ['18 %', true], ['100 %', true], ['↻ 4 h 52', false], ['↻ 2 j 13 h', false], ['│', false], ['0000000000', false],
]
const rouge = (w: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="8"><rect width="${w}" height="8" fill="#DC2626"/></svg>`

export const register: Register = on => {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'desktop') return next(e)
    const { Box, Text, Svg } = $.ui.resolve(e) as unknown as Record<string, (p: Record<string, unknown>) => unknown>
    const dessous = await next(e)
    const regle = (
      <Box flexDirection="column" gap={1}>
        <Text>{`regle · colonnes ${e.props.bodyColumns}`}</Text>
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Box width={20} height={1} backgroundColor="#2563EB" />
          <Svg source={rouge(160)} alt="160 px" width={160} height={8} />
          <Box width={1} height={1} backgroundColor="#111111" />
          <Box width={1} height={1} backgroundColor="#111111" />
        </Box>
        <Box flexDirection="row" flexWrap="wrap" alignItems="center" gap={2}>
          {TEXTES.map(([t, gras]) => <Box key={t} backgroundColor={JAUNE}><Text bold={gras}>{t}</Text></Box>)}
        </Box>
      </Box>
    )
    return (dessous ? <Box flexDirection="column" gap={1}>{regle}{dessous}</Box> : regle) as never
  })
}
