import { describe, it, expect } from 'vitest'
import { isSafeHttpUrl } from './url'

describe('isSafeHttpUrl', () => {
  it('http/https URL을 허용한다', () => {
    expect(isSafeHttpUrl('https://github.com/lodash/lodash')).toBe(true)
    expect(isSafeHttpUrl('http://example.com')).toBe(true)
  })

  it('앞뒤 공백이 있어도 허용한다', () => {
    expect(isSafeHttpUrl('  https://example.com  ')).toBe(true)
  })

  it('빈 값을 거부한다', () => {
    expect(isSafeHttpUrl(null)).toBe(false)
    expect(isSafeHttpUrl(undefined)).toBe(false)
    expect(isSafeHttpUrl('')).toBe(false)
    expect(isSafeHttpUrl('   ')).toBe(false)
  })

  it('스크립트 실행이 가능한 스킴을 거부한다', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isSafeHttpUrl('vbscript:msgbox(1)')).toBe(false)
  })

  it('http가 아닌 스킴을 거부한다', () => {
    expect(isSafeHttpUrl('ftp://example.com')).toBe(false)
    expect(isSafeHttpUrl('file:///etc/passwd')).toBe(false)
  })

  it('URL이 아닌 문자열을 거부한다', () => {
    expect(isSafeHttpUrl('github.com/lodash')).toBe(false)
    expect(isSafeHttpUrl('n/a')).toBe(false)
  })
})
