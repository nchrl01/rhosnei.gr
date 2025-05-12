import React, { useState } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

const ActivitiesSection = styled.section`
  padding: 3rem 0;
  background: white;
`;

const Container = styled.div`
  max-width: 48rem;
  width: 100%;
  margin: 0 auto;
  padding: 0 clamp(10px, 3vw, 20px);
`;

const ActivityCard = styled.div`
  padding: 3rem 0;
  border-bottom: 1px solid rgba(214, 108, 122, 0.2);

  &:last-child {
    border-bottom: none;
  }

  @media (max-width: 768px) {
    padding: 2rem 0;
  }
`;

const Title = styled(motion.h2)`
  font-family: 'BiancoSans', sans-serif;
  font-size: clamp(1.2rem, 2.5vw, 1.5rem);
  color: #d66c7a;
  font-weight: normal;
  margin-bottom: 1.5rem;
  text-align: center;
`;

const Description = styled(motion.p)`
  font-family: 'BiancoSans', sans-serif;
  font-size: clamp(0.75rem, 1.6vw, 0.85rem);
  line-height: 1.6;
  color: #666;
  margin-bottom: 1rem;
  text-align: center;
  white-space: pre-line;

  &:last-child {
    margin-bottom: 0;
  }
`;

const ContactInfo = styled(motion.p)`
  font-family: 'BiancoSans', sans-serif;
  font-size: clamp(0.75rem, 1.6vw, 0.85rem);
  color: #d66c7a;
  margin-top: 1.5rem;
  text-align: center;
`;

const PhoneLink = styled.a`
  font-family: 'BiancoSans', sans-serif;
  font-size: clamp(0.75rem, 1.6vw, 0.85rem);
  color: #d66c7a;
  text-decoration: none;
  display: block;
  margin-top: 1.5rem;
  text-align: center;
  
  &:hover {
    text-decoration: underline;
  }
`;

const ExpandButton = styled(motion.button)`
  font-family: 'BiancoSans', sans-serif;
  font-size: clamp(0.75rem, 1.6vw, 0.85rem);
  color: #d66c7a;
  background: none;
  border: none;
  padding: 0.5rem 1rem;
  margin: 1rem auto;
  cursor: pointer;
  display: block;
  border: 1px solid #d66c7a;
  transition: all 0.2s ease;

  &:hover {
    background: #d66c7a;
    color: white;
  }
`;

const ExpandableContent = styled(motion.div)`
  overflow: hidden;
`;

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.25 }
};

const Highlight = styled.span`
  color: #d66c7a;
  font-weight: 500;
`;

const Quote = styled.blockquote`
  color: #d66c7a;
  font-style: italic;
  text-align: center;
  margin: 1.5rem auto;
  padding: 0 1rem;
  font-size: clamp(0.8rem, 1.7vw, 0.9rem);
  line-height: 1.8;
  max-width: 42rem;
`;

const SubTitle = styled.h3`
  font-family: 'BiancoSans', sans-serif;
  font-size: clamp(0.9rem, 2vw, 1.1rem);
  color: #d66c7a;
  font-weight: normal;
  margin: 1.5rem 0 1rem;
  text-align: center;
`;

const Activities = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <ActivitiesSection>
      <Container>
        <ActivityCard>
          <Title {...fadeInUp}>
            Holistic therapies and massage
          </Title>
          <Description {...fadeInUp}>
            Since holidays are mainly to relax and rejuvenate, in Rodi boutique hotel you can enjoy holistic therapies and massage sessions.
            
            <Highlight> Gina</Highlight>, a holistic therapist with many years of experience, will offer you the session you wish. You may choose between <Highlight>Ayurvedic massage, deep tissue, massage for pregnant women, Rejuvance, Tachyon</Highlight> or something more specialized. Organic products and essential oils are exclusively used.
          </Description>
          <PhoneLink 
            href="tel:+306988030180"
            {...fadeInUp}
          >
            Call for appointment at: (+30) 698 8030 180
          </PhoneLink>
        </ActivityCard>

        <ActivityCard>
          <Title {...fadeInUp}>
            A Tsipouro Celebration at Rodi Boutique Hotel
          </Title>
          <Description {...fadeInUp}>
            Every November, friends and guests of Rodi Boutique Hotel gather for a special tradition. The celebration starts deep in the forest, at a rustic hut, and ends by the hotel's warm fireplace. Together, we distill <Highlight>tsipouro (raki)</Highlight> and honor this time-honored craft.
          </Description>
          <AnimatePresence>
            {isExpanded && (
              <ExpandableContent
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              >
                <Description>
                  <SubTitle>The Story of Tsipouro</SubTitle>
                  No one knows exactly who first made tsipouro or how it came to be. We search through old books, explore traditions, and piece together its origins. Passed down from father to son, the recipe has evolved, with each generation adding its own touch.

                  <Quote>The story unfolds like a fairy tale. The land (a nurturing mother) provides grapes for her children (the vines). Fermentation (good fairies) and souring (wicked wizards) battle for control. Magic and elves transform the grapes into wine, while the distillation pot (fire-breathing dragons) brings them to their final state.</Quote>

                  Then comes the moment of wonder—<Highlight>the pure distillate, known as "the tears of the Virgin,"</Highlight> flows from the still. This all happens in a smoky, dimly lit distillery, where laughter and song fill the cold winter nights.

                  <SubTitle>The Annual Tradition</SubTitle>
                  Since last year's tsipouro has long been enjoyed, November is the perfect time to distill a new batch. The weekend follows this schedule:

                  <Highlight> Saturday, 10:00 AM</Highlight> – We arrive in Kokkinomilia to taste the first tsipouro of the season alongside traditional appetizers.

                  <Highlight> Morning Distillation</Highlight> – John, the owner of the still, starts early so that by our arrival, the first batch is ready for sampling. We then watch as the next batch is prepared.

                  <Highlight> Afternoon Feast (2:00 PM)</Highlight> – We visit a local tavern for a meal featuring regional recipes.

                  <Highlight> Evening Festivities</Highlight> – In the early evening, we travel to Rovies (about 30 minutes away). The night continues at Rodi Boutique Hotel, with music and dancing by the fireplace.

                  <Highlight> Sunday Morning</Highlight> – We start with a homemade breakfast made from local ingredients. Then, we bottle the tsipouro and enjoy a relaxing day in Rovies.

                  <Quote>Join us in celebrating this cherished tradition, where history, craftsmanship, and camaraderie come together.</Quote>
                </Description>
              </ExpandableContent>
            )}
          </AnimatePresence>
          <ExpandButton 
            onClick={() => setIsExpanded(!isExpanded)}
            {...fadeInUp}
          >
            {isExpanded ? "Read Less" : "Read More"}
          </ExpandButton>
        </ActivityCard>

        <ActivityCard>
          <Title {...fadeInUp}>
            Mushrooms and herbs picking
          </Title>
          <Description {...fadeInUp}>
            Join us on a walk through the forest to gather <Highlight>wild mushrooms and aromatic herbs</Highlight>, guided by local expertise. Discover nature's seasonal treasures and enjoy their fresh flavors. <Highlight>Ask at the reception</Highlight> for more information.
          </Description>
        </ActivityCard>
      </Container>
    </ActivitiesSection>
  );
};

export default Activities; 