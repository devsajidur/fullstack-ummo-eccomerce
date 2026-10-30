import React from 'react'
import Banner from '../components/layout/home/Banner'
import Category from '../components/layout/home/Category'
import BestDealsSection from '../components/layout/home/BestDealsSection'
import TrendyProducts from '../components/layout/home/TrendyProducts'
import SpringCollection from '../components/layout/home/SpringCollection'
import Starting from '../components/layout/home/Starting'
import LimitedEdition from '../components/layout/home/LimitedEdition'
import Sponcer from '../components/layout/home/Sponcer'
import Services from '../components/layout/home/Services'

const HomePage = () => {
  return (
    <>
      <Banner />
      <Category />
      <BestDealsSection />
      <TrendyProducts />
      <SpringCollection />
      <Starting />
      <LimitedEdition />
      <Sponcer />
      <Services />
    </>
  )
}

export default HomePage
