package com.driveease.mapper;

import com.driveease.dto.payment.PaymentResponse;
import com.driveease.dto.payment.RefundResponse;
import com.driveease.entity.Payment;
import com.driveease.entity.Refund;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class PaymentMapper {

    public PaymentResponse toResponse(Payment payment, BigDecimal refundedAmount) {
        if (payment == null) {
            return null;
        }
        return new PaymentResponse(
                payment.getId(),
                payment.getPaymentReference(),
                payment.getTransactionRef(),
                payment.getBooking().getId(),
                payment.getBooking().getBookingReference(),
                payment.getAmount(),
                refundedAmount == null ? BigDecimal.ZERO : refundedAmount,
                payment.getCurrency(),
                payment.getPaymentMethod(),
                payment.getStatus(),
                payment.getFailureReason(),
                payment.getCardLast4(),
                payment.getPaidAt(),
                payment.getCreatedAt());
    }

    public RefundResponse toResponse(Refund refund) {
        return toResponse(refund, null);
    }

    public RefundResponse toResponse(Refund refund, String processedByName) {
        if (refund == null) {
            return null;
        }
        return new RefundResponse(
                refund.getId(),
                refund.getRefundReference(),
                refund.getPayment().getId(),
                refund.getPayment().getPaymentReference(),
                refund.getBooking().getId(),
                refund.getBooking().getBookingReference(),
                refund.getAmount(),
                refund.getReason(),
                refund.getSource(),
                refund.getStatus(),
                refund.getProcessedBy(),
                processedByName,
                refund.getCreatedAt());
    }
}
