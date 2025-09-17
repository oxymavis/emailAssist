import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Dialog,
  DialogContent,
  DialogActions,
  IconButton,
  LinearProgress,
  Chip,
  Zoom,
  Fade,
  Slide,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Close as CloseIcon,
  NavigateNext as NextIcon,
  NavigateBefore as BackIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  SkipNext as SkipIcon,
  Check as CheckIcon,
  Help as HelpIcon,
} from '@mui/icons-material';

import {
  userExperienceService,
  OnboardingFlow,
  OnboardingStep,
  UserProgress,
} from '../../services/userExperienceService';

interface OnboardingGuideProps {
  flowId: string;
  userId: string;
  onComplete?: (progress: UserProgress) => void;
  onSkip?: (stepId: string) => void;
  onClose?: () => void;
  autoStart?: boolean;
  customContent?: Record<string, React.ReactNode>;
}

interface StepHighlightProps {
  target: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  children: React.ReactNode;
  show: boolean;
}

const StepHighlight: React.FC<StepHighlightProps> = ({
  target,
  position,
  children,
  show
}) => {
  const [elementRect, setElementRect] = useState<DOMRect | null>(null);
  const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!show || !target) return;

    const updatePosition = () => {
      const element = document.querySelector(target) as HTMLElement;
      if (element) {
        const rect = element.getBoundingClientRect();
        setElementRect(rect);

        // 创建高亮遮罩样式
        setOverlayStyle({
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            radial-gradient(
              ellipse at ${rect.left + rect.width / 2}px ${rect.top + rect.height / 2}px,
              transparent ${Math.max(rect.width, rect.height) / 2 + 10}px,
              rgba(0, 0, 0, 0.7) ${Math.max(rect.width, rect.height) / 2 + 20}px
            )
          `,
          zIndex: 9998,
          pointerEvents: 'none',
        });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [target, show]);

  if (!show || !elementRect) return null;

  const getPopoverPosition = (): React.CSSProperties => {
    const padding = 20;
    const popoverWidth = 320;
    const popoverHeight = 200;

    let top: number;
    let left: number;

    switch (position) {
      case 'top':
        top = elementRect.top - popoverHeight - padding;
        left = elementRect.left + elementRect.width / 2 - popoverWidth / 2;
        break;
      case 'bottom':
        top = elementRect.bottom + padding;
        left = elementRect.left + elementRect.width / 2 - popoverWidth / 2;
        break;
      case 'left':
        top = elementRect.top + elementRect.height / 2 - popoverHeight / 2;
        left = elementRect.left - popoverWidth - padding;
        break;
      case 'right':
        top = elementRect.top + elementRect.height / 2 - popoverHeight / 2;
        left = elementRect.right + padding;
        break;
      case 'center':
      default:
        top = window.innerHeight / 2 - popoverHeight / 2;
        left = window.innerWidth / 2 - popoverWidth / 2;
        break;
    }

    // 确保弹窗在视口内
    top = Math.max(padding, Math.min(window.innerHeight - popoverHeight - padding, top));
    left = Math.max(padding, Math.min(window.innerWidth - popoverWidth - padding, left));

    return {
      position: 'fixed',
      top,
      left,
      width: popoverWidth,
      minHeight: popoverHeight,
      zIndex: 9999,
    };
  };

  return (
    <>
      {/* 遮罩层 */}
      <div style={overlayStyle} />

      {/* 弹窗内容 */}
      <Zoom in={show}>
        <Paper
          elevation={8}
          sx={{
            ...getPopoverPosition(),
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          {children}
        </Paper>
      </Zoom>
    </>
  );
};

const OnboardingGuide: React.FC<OnboardingGuideProps> = ({
  flowId,
  userId,
  onComplete,
  onSkip,
  onClose,
  autoStart = true,
  customContent = {}
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [flow, setFlow] = useState<OnboardingFlow | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    loadFlow();
  }, [flowId, userId]);

  useEffect(() => {
    if (flow && autoStart) {
      startFlow();
    }
  }, [flow, autoStart]);

  const loadFlow = async () => {
    try {
      setLoading(true);
      const flowData = userExperienceService.getOnboardingFlow(flowId);
      if (!flowData) {
        throw new Error(`Flow ${flowId} not found`);
      }

      setFlow(flowData);

      // 检查是否有已存在的进度
      const existingProgress = userExperienceService.getUserProgress(userId, flowId);
      if (existingProgress && existingProgress.status === 'in_progress') {
        setProgress(existingProgress);
        setCurrentStepIndex(existingProgress.currentStep);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load onboarding flow');
    } finally {
      setLoading(false);
    }
  };

  const startFlow = async () => {
    if (!flow) return;

    try {
      let progressData = progress;
      if (!progressData || progressData.status !== 'in_progress') {
        progressData = await userExperienceService.startOnboardingFlow(flowId, userId);
        setProgress(progressData);
      }

      setIsActive(true);
      setCurrentStepIndex(progressData.currentStep);
      startTimeRef.current = Date.now();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start onboarding flow');
    }
  };

  const nextStep = useCallback(async () => {
    if (!flow || !progress) return;

    const currentStep = flow.steps[currentStepIndex];
    const stepDuration = Date.now() - startTimeRef.current;

    // 记录当前步骤完成
    await userExperienceService.completeStep(
      userId,
      flowId,
      currentStep.id,
      stepDuration
    );

    if (currentStepIndex >= flow.steps.length - 1) {
      // 完成整个流程
      await completeFlow();
    } else {
      // 进入下一步
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);

      await userExperienceService.updateUserProgress(userId, flowId, {
        currentStep: nextIndex
      });

      startTimeRef.current = Date.now();
    }
  }, [flow, progress, currentStepIndex, userId, flowId]);

  const previousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
      startTimeRef.current = Date.now();
    }
  }, [currentStepIndex]);

  const skipStep = useCallback(async () => {
    if (!flow || !progress) return;

    const currentStep = flow.steps[currentStepIndex];

    if (currentStep.skippable !== false) {
      await userExperienceService.skipStep(userId, flowId, currentStep.id);
      onSkip?.(currentStep.id);
      await nextStep();
    }
  }, [flow, progress, currentStepIndex, userId, flowId, nextStep, onSkip]);

  const completeFlow = async () => {
    if (!progress) return;

    const updatedProgress = await userExperienceService.updateUserProgress(userId, flowId, {
      status: 'completed',
      completedAt: new Date()
    });

    if (updatedProgress) {
      setProgress(updatedProgress);
      onComplete?.(updatedProgress);
    }

    setIsActive(false);
  };

  const closeFlow = () => {
    setIsActive(false);
    onClose?.();
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  if (loading) {
    return (
      <Dialog open={true}>
        <DialogContent>
          <Box display="flex" alignItems="center" gap={2} p={2}>
            <LinearProgress sx={{ flex: 1 }} />
            <Typography>加载引导流程...</Typography>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={true} onClose={closeFlow}>
        <DialogContent>
          <Typography color="error" gutterBottom>
            引导流程加载失败
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {error}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeFlow}>关闭</Button>
        </DialogActions>
      </Dialog>
    );
  }

  if (!flow || !isActive) return null;

  const currentStep = flow.steps[currentStepIndex];
  const progressPercentage = ((currentStepIndex + 1) / flow.steps.length) * 100;

  const renderStepContent = () => {
    const customStepContent = customContent[currentStep.id];

    return (
      <Box p={3}>
        {/* 头部 */}
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box flex={1}>
            <Typography variant="h6" gutterBottom>
              {currentStep.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {currentStep.description}
            </Typography>
          </Box>

          <Box display="flex" gap={1}>
            <IconButton size="small" onClick={togglePause}>
              {isPaused ? <PlayIcon /> : <PauseIcon />}
            </IconButton>
            <IconButton size="small" onClick={closeFlow}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* 进度条 */}
        {flow.settings.showProgress && (
          <Box mb={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="caption" color="text.secondary">
                进度: {currentStepIndex + 1} / {flow.steps.length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {Math.round(progressPercentage)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progressPercentage}
              sx={{ borderRadius: 1, height: 6 }}
            />
          </Box>
        )}

        {/* 步骤指示器 */}
        {!isMobile && flow.steps.length > 1 && (
          <Box mb={3}>
            <Stepper activeStep={currentStepIndex} alternativeLabel>
              {flow.steps.map((step, index) => (
                <Step key={step.id} completed={index < currentStepIndex}>
                  <StepLabel>
                    <Typography variant="caption">
                      {step.title}
                    </Typography>
                  </StepLabel>
                </Step>
              ))}
            </Stepper>
          </Box>
        )}

        {/* 媒体内容 */}
        {currentStep.media && (
          <Box mb={2} textAlign="center">
            {currentStep.media.type === 'image' && (
              <img
                src={currentStep.media.url}
                alt={currentStep.media.alt || currentStep.title}
                style={{ maxWidth: '100%', height: 'auto', borderRadius: 8 }}
              />
            )}
            {currentStep.media.type === 'video' && (
              <video
                src={currentStep.media.url}
                controls
                style={{ maxWidth: '100%', height: 'auto', borderRadius: 8 }}
              />
            )}
          </Box>
        )}

        {/* 自定义内容 */}
        {customStepContent && (
          <Box mb={2}>
            {customStepContent}
          </Box>
        )}

        {/* 交互提示 */}
        {currentStep.action && (
          <Box mb={2}>
            <Chip
              icon={<HelpIcon />}
              label={`请${currentStep.action === 'click' ? '点击' : currentStep.action}指定元素`}
              color="primary"
              variant="outlined"
              size="small"
            />
          </Box>
        )}

        {/* 操作按钮 */}
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Button
            onClick={previousStep}
            disabled={currentStepIndex === 0}
            startIcon={<BackIcon />}
            size="small"
          >
            上一步
          </Button>

          <Box display="flex" gap={1}>
            {currentStep.skippable !== false && (
              <Button
                onClick={skipStep}
                color="inherit"
                size="small"
                startIcon={<SkipIcon />}
              >
                跳过
              </Button>
            )}

            <Button
              onClick={nextStep}
              variant="contained"
              endIcon={currentStepIndex >= flow.steps.length - 1 ? <CheckIcon /> : <NextIcon />}
              size="small"
            >
              {currentStepIndex >= flow.steps.length - 1 ? '完成' : '下一步'}
            </Button>
          </Box>
        </Box>
      </Box>
    );
  };

  // 如果有目标元素，使用高亮模式
  if (currentStep.target) {
    return (
      <StepHighlight
        target={currentStep.target}
        position={currentStep.position || 'bottom'}
        show={isActive && !isPaused}
      >
        {renderStepContent()}
      </StepHighlight>
    );
  }

  // 否则使用对话框模式
  return (
    <Dialog
      open={isActive && !isPaused}
      onClose={flow.settings.allowSkip ? closeFlow : undefined}
      maxWidth="sm"
      fullWidth
      TransitionComponent={Fade}
      keepMounted={false}
    >
      <DialogContent sx={{ p: 0 }}>
        {renderStepContent()}
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingGuide;