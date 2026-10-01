import { describe, expect, it } from 'vitest'
import { provedoresSociaisConfigurados } from './provedores-sociais'

/**
 * Um botão de login social só aparece com a credencial completa do provedor
 * (specs/020-resolver-pendencias, FR-010): com o ID e sem o segredo, clicar no
 * botão falharia no callback OAuth.
 */
const GOOGLE = { GOOGLE_CLIENT_ID: 'id-google', GOOGLE_CLIENT_SECRET: 'segredo-google' }
const FACEBOOK = { FACEBOOK_CLIENT_ID: 'id-facebook', FACEBOOK_CLIENT_SECRET: 'segredo-facebook' }

describe('provedoresSociaisConfigurados', () => {
    it('lista os dois provedores quando ambos estão completos', () => {
        expect(provedoresSociaisConfigurados({ ...GOOGLE, ...FACEBOOK })).toEqual(['google', 'facebook'])
    })

    it('lista só o Google quando só ele está configurado', () => {
        expect(provedoresSociaisConfigurados(GOOGLE)).toEqual(['google'])
    })

    it('lista só o Facebook quando só ele está configurado', () => {
        expect(provedoresSociaisConfigurados(FACEBOOK)).toEqual(['facebook'])
    })

    it('ignora provedor com ID e sem segredo', () => {
        expect(provedoresSociaisConfigurados({ GOOGLE_CLIENT_ID: 'id-google', ...FACEBOOK })).toEqual(['facebook'])
    })

    it('ignora provedor com segredo vazio ou só com espaços', () => {
        expect(provedoresSociaisConfigurados({ GOOGLE_CLIENT_ID: 'id-google', GOOGLE_CLIENT_SECRET: '' })).toEqual([])
        expect(provedoresSociaisConfigurados({ GOOGLE_CLIENT_ID: 'id-google', GOOGLE_CLIENT_SECRET: '   ' })).toEqual(
            []
        )
    })

    it('ignora provedor com ID só com espaços', () => {
        expect(provedoresSociaisConfigurados({ GOOGLE_CLIENT_ID: '  ', GOOGLE_CLIENT_SECRET: 'segredo' })).toEqual([])
    })

    it('devolve lista vazia sem nenhuma credencial', () => {
        expect(provedoresSociaisConfigurados({})).toEqual([])
    })

    it('mantém a ordem google antes de facebook, independentemente da ordem do ambiente', () => {
        expect(provedoresSociaisConfigurados({ ...FACEBOOK, ...GOOGLE })).toEqual(['google', 'facebook'])
    })
})
