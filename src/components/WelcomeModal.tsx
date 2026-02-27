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
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
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
  background: rgba(10, 15, 25, 0.85);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 16px;
  padding: 40px;
  max-width: 520px;
  width: 90%;
  box-shadow:
    0 0 40px rgba(0, 212, 255, 0.2),
    0 0 80px rgba(0, 0, 0, 0.5),
    inset 0 0 60px rgba(0, 212, 255, 0.05);
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
  background: ${props => props.active ? 'rgba(0, 212, 255, 0.3)' : 'transparent'};
  border: 1px solid ${props => props.active ? '#00d4ff' : 'rgba(0, 212, 255, 0.3)'};
  color: ${props => props.active ? '#00d4ff' : 'rgba(255, 255, 255, 0.5)'};
  padding: ${props => props.isLarge ? '6px 14px' : '4px 10px'};
  border-radius: 4px;
  font-size: ${props => props.isLarge ? '14px' : '11px'};
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: ${props => props.isLarge ? "'Microsoft YaHei', 'PingFang SC', sans-serif" : "'Consolas', 'Monaco', monospace"};

  &:hover {
    border-color: #00d4ff;
    color: #00d4ff;
  }
`;

const ModalHeader = styled.div`
  text-align: center;
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid rgba(0, 212, 255, 0.2);
`;

const Title = styled.h1`
  font-size: 32px;
  font-weight: 700;
  color: #00d4ff;
  margin: 0 0 8px 0;
  font-family: 'Consolas', 'Monaco', monospace;
  letter-spacing: 4px;
  text-shadow: 0 0 20px rgba(0, 212, 255, 0.5);
`;

const Subtitle = styled.p`
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
  letter-spacing: 2px;
`;

const ModalContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const Section = styled.div``;

const SectionTitle = styled.h3`
  font-size: 12px;
  color: #00d4ff;
  margin: 0 0 12px 0;
  font-family: 'Consolas', 'Monaco', monospace;
  letter-spacing: 2px;
  opacity: 0.8;
`;

const Description = styled.p`
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
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
  color: #00d4ff;
  font-family: 'Consolas', 'Monaco', monospace;
  min-width: 20px;
`;

const FeatureText = styled.span`
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
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
  background: linear-gradient(135deg, #00d4ff 0%, #0088bb 100%);
  border: none;
  border-radius: 8px;
  padding: 14px 36px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  color: white;
  font-family: 'Consolas', 'Monaco', monospace;
  letter-spacing: 2px;
  transition: all 0.3s ease;
  box-shadow: 0 0 30px rgba(0, 212, 255, 0.4);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 0 40px rgba(0, 212, 255, 0.6);
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
  color: rgba(0, 212, 255, 0.4);
  font-family: 'Consolas', 'Monaco', monospace;
`;
