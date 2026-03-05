import styled from 'styled-components';
import { useLanguage, type Language } from '../context/LanguageContext';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  const { lang, setLang, t } = useLanguage();

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
  };

  if (!isOpen) return null;

  return (
    <Overlay>
      <Modal>
        <LanguageSwitch>
          <LangButton active={lang === 'zh'} isLarge onClick={() => handleLanguageChange('zh')}>中文</LangButton>
          <LangButton active={lang === 'ja'} onClick={() => handleLanguageChange('ja')}>日本語</LangButton>
          <LangButton active={lang === 'en'} onClick={() => handleLanguageChange('en')}>EN</LangButton>
        </LanguageSwitch>

        <ModalHeader>
          <Title>{t.title}</Title>
          <Subtitle>{t.subtitle}</Subtitle>
        </ModalHeader>

        <ModalContent>
          <Section>
            <SectionTitle>{t.about}</SectionTitle>
            <Description>{t.aboutText}</Description>
          </Section>

          <Section>
            <SectionTitle>{t.features}</SectionTitle>
            <FeatureList>
              <FeatureItem>
                <FeatureIcon>◈</FeatureIcon>
                <FeatureText>{t.feature1}</FeatureText>
              </FeatureItem>
              <FeatureItem>
                <FeatureIcon>◈</FeatureIcon>
                <FeatureText>{t.feature2}</FeatureText>
              </FeatureItem>
              <FeatureItem>
                <FeatureIcon>◈</FeatureIcon>
                <FeatureText>{t.feature3}</FeatureText>
              </FeatureItem>
            </FeatureList>
          </Section>

          <Section>
            <SectionTitle>{t.howto}</SectionTitle>
            <FeatureList>
              <FeatureItem>
                <FeatureIcon>01</FeatureIcon>
                <FeatureText>{t.step1}</FeatureText>
              </FeatureItem>
              <FeatureItem>
                <FeatureIcon>02</FeatureIcon>
                <FeatureText>{t.step2}</FeatureText>
              </FeatureItem>
              <FeatureItem>
                <FeatureIcon>03</FeatureIcon>
                <FeatureText>{t.step3}</FeatureText>
              </FeatureItem>
            </FeatureList>
          </Section>
        </ModalContent>

        <ModalFooter>
          <StartButton onClick={onClose} autoFocus>
            <span>{t.start}</span>
            <Arrow>→</Arrow>
          </StartButton>
        </ModalFooter>

        <VersionTag>v1.0 | Data: ADSB.lol + HexDB.io</VersionTag>
      </Modal>
    </Overlay>
  );
}

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.3s ease;

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const Modal = styled.div`
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  padding: 40px;
  max-width: 520px;
  width: 90%;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  animation: slideUp 0.4s ease;
  position: relative;

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const LanguageSwitch = styled.div`
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  gap: 4px;
`;

const LangButton = styled.button<{ active: boolean; isLarge?: boolean }>`
  background: ${props => props.active ? '#6366F1' : '#F3F4F6'};
  border: 1px solid ${props => props.active ? '#6366F1' : '#E5E7EB'};
  color: ${props => props.active ? '#FFFFFF' : '#6B7280'};
  padding: ${props => props.isLarge ? '6px 14px' : '4px 10px'};
  border-radius: 6px;
  font-size: ${props => props.isLarge ? '14px' : '11px'};
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: ${props => props.isLarge ? "'Microsoft YaHei', 'PingFang SC', sans-serif" : "'Consolas', 'Monaco', monospace"};

  &:hover {
    border-color: #6366F1;
    background: ${props => props.active ? '#4F46E5' : '#E5E7EB'};
  }
`;

const ModalHeader = styled.div`
  text-align: center;
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid #E5E7EB;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: #6366F1;
  margin: 0 0 8px 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  letter-spacing: 2px;
`;

const Subtitle = styled.p`
  font-size: 14px;
  color: #6B7280;
  margin: 0;
  letter-spacing: 1px;
`;

const ModalContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const Section = styled.div``;

const SectionTitle = styled.h3`
  font-size: 12px;
  color: #6366F1;
  margin: 0 0 12px 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  letter-spacing: 1px;
  font-weight: 600;
  text-transform: uppercase;
`;

const Description = styled.p`
  font-size: 14px;
  color: #374151;
  margin: 0;
  line-height: 1.8;
`;

const FeatureList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const FeatureItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const FeatureIcon = styled.span`
  font-size: 11px;
  color: #6366F1;
  font-family: 'Consolas', 'Monaco', monospace;
  min-width: 20px;
`;

const FeatureText = styled.span`
  font-size: 13px;
  color: #4B5563;
`;

const ModalFooter = styled.div`
  margin-top: 32px;
  display: flex;
  justify-content: center;
`;

const StartButton = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  background: #6366F1;
  border: none;
  border-radius: 8px;
  padding: 14px 36px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  color: white;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  letter-spacing: 1px;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);

  &:hover {
    background: #4F46E5;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  }

  &:active {
    transform: translateY(0);
  }
`;

const Arrow = styled.span`
  font-size: 18px;
  transition: transform 0.3s ease;

  ${StartButton}:hover & {
    transform: translateX(4px);
  }
`;

const VersionTag = styled.div`
  text-align: center;
  margin-top: 24px;
  font-size: 11px;
  color: #9CA3AF;
  font-family: 'Consolas', 'Monaco', monospace;
`;
