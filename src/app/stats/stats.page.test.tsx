import { render, screen } from '@testing-library/react'
import React from 'react'
import StatsPage from './page'

function mockFetchOnce(data: any, ok = true) {
  ;(global as any).fetch = jest.fn().mockResolvedValue({
    ok,
    json: async () => data
  })
}

beforeEach(() => {
  const store: Record<string, string> = {}
  ;(global as any).localStorage = {
    getItem: (k: string) => store[k] || '',
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] }
  }
})

test('stats page shows values when API returns data', async () => {
  ;(global as any).localStorage.setItem('geneasphere_token', 'fake_token')

  mockFetchOnce({
    totalMembers: 10,
    men: 6,
    women: 4,
    other: 0,
    avgLifeExpectancyYears: 78.5,
    generations: 3,
    avgLifeExpectancy: 78.5,
    avgChildrenPerGeneration: 2.25,
    generationsCount: 3
  })

  render(<StatsPage />)

  expect(await screen.findByText('Statistiques')).toBeInTheDocument()
  expect(await screen.findByText(/Total membres/)).toBeInTheDocument()
  expect(await screen.findByText('10')).toBeInTheDocument()
  expect(await screen.findByText('6')).toBeInTheDocument()
  expect(await screen.findByText('4')).toBeInTheDocument()
  expect(await screen.findByText(/78.5 ans/)).toBeInTheDocument()
  expect(await screen.findByText('2.25')).toBeInTheDocument()
  expect(await screen.findByText('3')).toBeInTheDocument()
})
